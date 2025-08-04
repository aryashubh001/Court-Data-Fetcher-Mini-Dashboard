// --- app.js ---
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors'); // Used for local development
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Base URL for the Delhi High Court search page
const BASE_URL = "https://delhihighcourt.nic.in/";
const SEARCH_URL = "https://delhihighcourt.nic.in/case_status_main.asp";

// Middleware
app.use(express.json()); // To parse JSON bodies
app.use(cors()); // Allow cross-origin requests for local testing

// Serve the static frontend file
// Assuming index.html is in a 'public' directory or at the root
app.use(express.static('public'));

// Create or connect to the SQLite database
const db = new sqlite3.Database('./court_data.db', (err) => {
    if (err) {
        console.error('Error connecting to the database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

// Function to initialize the database and create the 'queries' table
function initDb() {
    db.run(`
        CREATE TABLE IF NOT EXISTS queries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_type TEXT NOT NULL,
            case_number TEXT NOT NULL,
            filing_year TEXT NOT NULL,
            raw_response TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating table:', err.message);
        } else {
            console.log('Database table "queries" is ready.');
        }
    });
}

// Function to log a query to the database
function logQuery(case_type, case_number, filing_year, raw_response) {
    const stmt = db.prepare(`
        INSERT INTO queries (case_type, case_number, filing_year, raw_response)
        VALUES (?, ?, ?, ?)
    `);
    stmt.run(case_type, case_number, filing_year, raw_response, (err) => {
        if (err) {
            console.error('Error logging query:', err.message);
        }
    });
    stmt.finalize();
}

// Function to solve the CAPTCHA using the Gemini API
async function solveCaptcha(imageUrl, session) {
    try {
        const imageResponse = await session.get(imageUrl, { responseType: 'arraybuffer' });
        const base64Image = Buffer.from(imageResponse.data, 'binary').toString('base64');
        
        const payload = {
            contents: [{
                parts: [
                    { text: "What is the text in this CAPTCHA image? Only provide the text." },
                    {
                        inlineData: {
                            mimeType: "image/jpeg",
                            data: base64Image
                        }
                    }
                ]
            }]
        };

        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        const geminiResponse = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        const result = geminiResponse.data;
        if (result && result.candidates && result.candidates.length > 0) {
            const text = result.candidates[0].content.parts[0].text;
            return text.trim();
        }

        return null;
    } catch (error) {
        console.error('Error solving CAPTCHA:', error.message);
        return null;
    }
}

// Main search endpoint
app.post('/search', async (req, res) => {
    try {
        const { case_type, case_number, filing_year } = req.body;

        if (!case_type || !case_number || !filing_year) {
            return res.status(400).json({ error: 'Please provide all required fields.' });
        }

        const session = axios.create();

        // Step 1: Get the initial page to retrieve cookies and CAPTCHA
        const response = await session.get(SEARCH_URL);
        const $ = cheerio.load(response.data);

        const captchaImgUrl = $('img[alt="CAPTCHA"]').attr('src');
        if (!captchaImgUrl) {
            return res.status(500).json({ error: 'Could not find CAPTCHA image on the page.' });
        }
        
        const fullCaptchaUrl = new URL(captchaImgUrl, BASE_URL).href;

        // Solve the CAPTCHA
        const captchaText = await solveCaptcha(fullCaptchaUrl, session);
        if (!captchaText) {
            return res.status(500).json({ error: 'Failed to solve CAPTCHA. Please try again.' });
        }
        
        // Step 2: Prepare and post the form data
        const formData = new URLSearchParams();
        formData.append('ca_type', case_type);
        formData.append('ca_no', case_number);
        formData.append('ca_year', filing_year);
        formData.append('image', captchaText);
        formData.append('SUBMIT', 'Submit');
        
        const resultResponse = await session.post(SEARCH_URL, formData.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        // Check for error messages in the response
        if (resultResponse.data.includes("Invalid Captcha")) {
            return res.status(400).json({ error: 'Invalid CAPTCHA submitted. Please try again.' });
        }
        
        if (resultResponse.data.includes("No Case Found")) {
            return res.status(404).json({ error: 'No case found with the provided details. Please check and try again.' });
        }

        // Step 3: Parse the results
        const result$ = cheerio.load(resultResponse.data);
        
        const caseDetails = {};
        result$('table.grid_new tr').each((i, row) => {
            const cells = result$(row).find('td');
            if (cells.length === 2) {
                const key = result$(cells[0]).text().trim().replace(':', '');
                const value = result$(cells[1]).text().trim();
                caseDetails[key] = value;
            }
        });

        let latestOrder = null;
        result$('table.list_box tr').slice(1).each((i, row) => { // Skip header row
            if (i === 0) {
                const cells = result$(row).find('td');
                if (cells.length > 3) {
                    const orderLink = result$(cells[3]).find('a').attr('href');
                    if (orderLink) {
                        latestOrder = {
                            date: result$(cells[0]).text().trim(),
                            description: result$(cells[1]).text().trim(),
                            link: new URL(orderLink, BASE_URL).href
                        };
                    }
                }
            }
        });

        // Log the raw response to the database
        logQuery(case_type, case_number, filing_year, resultResponse.data);

        return res.json({
            success: true,
            case_details: caseDetails,
            latest_order: latestOrder
        });

    } catch (error) {
        console.error('An unexpected error occurred:', error);
        res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
    }
});


// Serve the index.html file
app.get('/', (req, res) => {
    // Assuming index.html is in the same directory as app.js
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
