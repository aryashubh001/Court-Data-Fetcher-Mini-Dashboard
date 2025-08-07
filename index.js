// This is your backend server file. It serves the static frontend
// and handles the API calls.
// This version uses MOCK_DATA for simulated web scraping, SQLite for persistent logging,
// and simulates CAPTCHA validation.

const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the 'public' directory.
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse JSON bodies from incoming requests.
app.use(express.json());

// --- CAPTCHA STATE ---
let currentCaptcha = {
    code: '',
    timestamp: 0 // To potentially add expiry later
};

// Function to generate a new random 4-digit CAPTCHA
function generateNewCaptcha() {
    const code = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit number
    currentCaptcha = {
        code: code,
        timestamp: Date.now()
    };
    console.log('New CAPTCHA generated:', currentCaptcha.code);
    return currentCaptcha.code;
}

// --- DATABASE INITIALIZATION (SQLite) ---
const db = new sqlite3.Database('./queries.db', (err) => {
    if (err) {
        console.error('Error connecting to SQLite database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS queries_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            case_type TEXT,
            case_number TEXT,
            filing_year TEXT,
            response_data TEXT,
            captcha_attempt TEXT
        )`, (createErr) => { // Added captcha_attempt column
            if (createErr) {
                console.error('Error creating table:', createErr.message);
            } else {
                console.log('Table "queries_log" ready.');
                // Generate initial CAPTCHA on server start
                generateNewCaptcha();
            }
        });
    }
});

/**
 * Logs a query and its response to the SQLite database.
 */
function logQueryToDb(query, response, captchaAttempt = '') { // Added captchaAttempt parameter
    const timestamp = new Date().toISOString();
    const sql = `INSERT INTO queries_log (timestamp, case_type, case_number, filing_year, response_data, captcha_attempt) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [
        timestamp,
        query.caseType,
        query.caseNumber,
        query.filingYear,
        JSON.stringify(response),
        captchaAttempt // Log the captcha attempt
    ], function(err) {
        if (err) {
            console.error('Error inserting into database:', err.message);
        } else {
            console.log(`Query logged with ID: ${this.lastID}`);
        }
    });
}

// --- MOCK DATA (SIMULATING WEBSCRAPING LOGIC) ---
const MOCK_CASES = {
    'criminal': [
        { caseType: 'Criminal Case', caseNumber: '101', filingYear: '2023', parties: 'State vs. A', filingDate: '2023-01-01', nextHearingDate: '2024-09-01', orders: [{ date: '2024-08-01', description: 'Order on bail.', pdfLink: 'https://placehold.co/600x400/FF0000/FFFFFF?text=Mock+PDF+1' }] },
        { caseType: 'Criminal Case', caseNumber: '102', filingYear: '2023', parties: 'State vs. B', filingDate: '2023-02-01', nextHearingDate: '2024-10-01', orders: [{ date: '2024-08-05', description: 'Next hearing date set.', pdfLink: 'https://placehold.co/600x400/FF0000/FFFFFF?text=Mock+PDF+2' }] },
        { caseType: 'Criminal Case', caseNumber: '103', filingYear: '2024', parties: 'State vs. C', filingDate: '2024-03-01', nextHearingDate: '2024-11-01', orders: [{ date: '2024-07-20', description: 'Final order.', pdfLink: 'https://placehold.co/600x400/FF0000/FFFFFF?text=Mock+PDF+3' }] },
        { caseType: 'Criminal Case', caseNumber: '104', filingYear: '2024', parties: 'State vs. D', filingDate: '2024-04-01', nextHearingDate: '2024-12-01', orders: [{ date: '2024-08-10', description: 'Interim order on evidence.', pdfLink: 'https://placehold.co/600x400/FF0000/FFFFFF?text=Mock+PDF+4' }] },
        { caseType: 'Criminal Case', caseNumber: '105', filingYear: '2024', parties: 'State vs. E', filingDate: '2024-05-01', nextHearingDate: '2025-01-01', orders: [{ date: '2024-08-15', description: 'Arguments heard.', pdfLink: 'https://placehold.co/600x400/FF0000/FFFFFF?text=Mock+PDF+5' }] }
    ],
    'civil': [
        { caseType: 'Civil Suit', caseNumber: '201', filingYear: '2022', parties: 'Plaintiff F vs. Defendant G', filingDate: '2022-01-01', nextHearingDate: '2024-09-02', orders: [{ date: '2024-08-02', description: 'Case review.', pdfLink: 'https://placehold.co/600x400/0000FF/FFFFFF?text=Mock+PDF+6' }] },
        { caseType: 'Civil Suit', caseNumber: '202', filingYear: '2023', parties: 'Plaintiff H vs. Defendant I', filingDate: '2023-02-02', nextHearingDate: '2024-10-02', orders: [{ date: '2024-08-06', description: 'Witness deposition.', pdfLink: 'https://placehold.co/600x400/0000FF/FFFFFF?text=Mock+PDF+7' }] },
        { caseType: 'Civil Suit', caseNumber: '203', filingYear: '2023', parties: 'Plaintiff J vs. Defendant K', filingDate: '2023-03-03', nextHearingDate: '2024-11-02', orders: [{ date: '2024-07-21', description: 'Mediation ordered.', pdfLink: 'https://placehold.co/600x400/0000FF/FFFFFF?text=Mock+PDF+8' }] },
        { caseType: 'Civil Suit', caseNumber: '204', filingYear: '2024', parties: 'Plaintiff L vs. Defendant M', filingDate: '2024-04-04', nextHearingDate: '2024-12-02', orders: [{ date: '2024-08-11', description: 'Interim relief granted.', pdfLink: 'https://placehold.co/600x400/0000FF/FFFFFF?text=Mock+PDF+9' }] },
        { caseType: 'Civil Suit', caseNumber: '205', filingYear: '2024', parties: 'Plaintiff N vs. Defendant O', filingDate: '2024-05-05', nextHearingDate: '2025-01-02', orders: [{ date: '2024-08-16', description: 'Case dismissed.', pdfLink: 'https://placehold.co/600x400/0000FF/FFFFFF?text=Mock+PDF+10' }] }
    ],
    'writ': [
        { caseType: 'Writ Petition', caseNumber: '301', filingYear: '2021', parties: 'Petitioner P vs. State', filingDate: '2021-01-01', nextHearingDate: '2024-09-03', orders: [{ date: '2024-08-03', description: 'Notice issued.', pdfLink: 'https://placehold.co/600x400/008000/FFFFFF?text=Mock+PDF+11' }] },
        { caseType: 'Writ Petition', caseNumber: '302', filingYear: '2022', parties: 'Petitioner Q vs. Union of India', filingDate: '2022-02-02', nextHearingDate: '2024-10-03', orders: [{ date: '2024-08-07', description: 'Directions for compliance.', pdfLink: 'https://placehold.co/600x400/008000/FFFFFF?text=Mock+PDF+12' }] },
        { caseType: 'Writ Petition', caseNumber: '303', filingYear: '2023', parties: 'Petitioner R vs. State', filingDate: '2023-03-03', nextHearingDate: '2024-11-03', orders: [{ date: '2024-07-22', description: 'Interim stay granted.', pdfLink: 'https://placehold.co/600x400/008000/FFFFFF?text=Mock+PDF+13' }] },
        { caseType: 'Writ Petition', caseNumber: '304', filingYear: '2024', parties: 'Petitioner S vs. Union of India', filingDate: '2024-04-04', nextHearingDate: '2024-12-03', orders: [{ date: '2024-08-12', description: 'Final arguments heard.', pdfLink: 'https://placehold.co/600x400/008000/FFFFFF?text=Mock+PDF+14' }] },
        { caseType: 'Writ Petition', caseNumber: '305', filingYear: '2024', parties: 'Petitioner T vs. State', filingDate: '2024-05-05', nextHearingDate: '2025-01-03', orders: [{ date: '2024-08-17', description: 'Petition dismissed.', pdfLink: 'https://placehold.co/600x400/008000/FFFFFF?text=Mock+PDF+15' }] }
    ]
};

// --- SIMULATED WEB SCRAPING LOGIC ---
async function scrapeCaseData(query) {
    const { caseType } = query;
    const casesForType = MOCK_CASES[caseType];

    // Simulate a network delay for realism
    await new Promise(resolve => setTimeout(resolve, 500));

    if (casesForType && casesForType.length > 0) {
        // Return a random case from the available mock cases for the given type
        const randomIndex = Math.floor(Math.random() * casesForType.length);
        const randomCase = casesForType[randomIndex];
        console.log('Simulated scraping successful. Returning a random mock case for type:', caseType);
        return randomCase;
    } else {
        console.log('Simulated scraping: No data found for type:', caseType);
        return null;
    }
}

// --- API ROUTES ---

// Endpoint to provide the current CAPTCHA code to the frontend
app.get('/api/captcha', (req, res) => {
    // Generate a new CAPTCHA on request for refresh
        
