# Court-Data-Fetcher-Mini-Dashboard

 ## 🚀 Project Objective

This project aims to build a small web application that simulates fetching and displaying case metadata and the latest orders/judgments for specific Indian court cases. The application provides a user-friendly interface to input case details and view the retrieved information, along with a log of past queries.

## 💻 Technologies Used

* **Backend:** Node.js, Express.js
* **Frontend:** HTML, CSS (Tailwind CSS), JavaScript
* **Database:** SQLite3 (for persistent query logging)
* **Deployment:** Render

## 🏛️ Court Targeted

The application is designed to simulate fetching data from the **Delhi High Court** (`https://delhihighcourt.nic.in/case-status.asp`).

## 🕸️ Web Scraping Strategy (Simulated)

For this submission, the web scraping functionality is **simulated** using an in-memory `MOCK_CASES` object. When a user queries for a case, the backend randomly selects one of the pre-defined mock cases for the specified case type.

**Reasoning for Simulation:**
Automating browser-based web scraping (especially with dynamic content and CAPTCHAs) on free-tier cloud platforms like Render can be highly resource-intensive, prone to instability, and often leads to deployment failures due to strict resource limits and security sandboxing. To ensure a reliably deployed and functional application for this task, a simulated approach was adopted.

**Future Work / Real-World Implementation:**
In a full production environment, the backend would integrate a robust web scraping library like Playwright. This would involve:
* Navigating to the live Delhi High Court website.
* Programmatically filling out search forms.
* Implementing strategies for CAPTCHA solving (e.g., integrating with third-party CAPTCHA-solving APIs or advanced OCR techniques).
* Extracting real-time case metadata and PDF links from the live site's HTML.

## 💾 Storage Strategy

Each user query and its corresponding (simulated) response are logged to a **SQLite database** (`queries.db`). This fulfills the requirement for persistent storage.

**Implementation Details:**
* The `sqlite3` Node.js package is used to interact with the database.
* A table named `queries_log` stores the `timestamp`, `case_type`, `case_number`, `filing_year`, `response_data` (as a JSON string), and `captcha_attempt` for each query.
* The frontend retrieves and displays these logs from the backend's `/api/log` endpoint.

**Future Work:**
For a large-scale production application, the SQLite database would be replaced with a more robust client-server RDBMS like **MySQL** or PostgreSQL, hosted on a dedicated database service, to ensure scalability and high availability.

## 🛡️ Simulated CAPTCHA Handling

The application includes a **simulated CAPTCHA verification** step.
* The frontend displays a random 4-digit numeric CAPTCHA.
* The user must enter this exact code into the CAPTCHA input field.
* The backend validates the entered CAPTCHA against the currently active CAPTCHA code.
* If the CAPTCHA is incorrect, an error message is displayed, and a new CAPTCHA is generated.
* This demonstrates the logic for handling CAPTCHA without relying on external services or complex image processing.

## 🚀 Deployment

The application is deployed as a full-stack Node.js web service on **Render**.

**Live Application URL:**
[https://court-data-fetcher-mini-dashboard-cg1h.onrender.com](https://court-data-fetcher-mini-dashboard-cg1h.onrender.com)

## 🧪 How to Run/Test the Live Application

1.  Open your web browser and navigate to the live application URL:
    [https://court-data-fetcher-mini-dashboard-cg1h.onrender.com](https://court-data-fetcher-mini-dashboard-cg1h.onrender.com)

2.  **Enter Case Details:**
    * You can choose any **Case Type** (Criminal Case, Civil Suit, Writ Petition).
    * You can type any **Case Number** (e.g., `123`, `999`, `abc`).
    * You can select any **Filing Year**.

3.  **Solve the CAPTCHA:**
    * Look at the **4-digit code** displayed in the "CAPTCHA Verification" section.
    * Type this exact code into the "Enter CAPTCHA Code Here" input field.
    * If you enter it incorrectly, it will display an error and generate a new CAPTCHA. Click the refresh icon (`<i class="fas fa-sync-alt"></i>`) to get a new CAPTCHA if needed.

4.  **Click "Fetch Data".**

**Expected Outcome:**
* Upon successful CAPTCHA entry, the "Case Details" section will display information for a **randomly selected mock case** corresponding to the chosen Case Type.
* The "Query Log" section at the bottom will update, showing your recent query and its status.
