// src/server/api.ts
import { Hono } from 'hono';
import { stream } from 'hono/streaming'; // For potentially large table rendering
import { jsxRenderer } from 'hono/jsx-renderer'; // If using Hono's JSX for HTML templating
import type { Env } from './rock-service';
import { findPersonInRock, updatePersonAttributeInRock } from './rock-service';

// Basic CSV parser (server-side)
interface CsvRowData {
    id: string; // Unique ID for HTMX targeting
    firstName: string;
    lastName: string;
    email: string;
}
function parseCSVText(csvText: string): CsvRowData[] {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headerLine = lines[0].toLowerCase();
    const headers = headerLine.split(',').map(h => h.trim());
    
    // Expecting "first_name", "last_name", "email" from your previous example
    const firstNameIndex = headers.indexOf('first_name');
    const lastNameIndex = headers.indexOf('last_name');
    const emailIndex = headers.indexOf('email');

    if (firstNameIndex === -1 || lastNameIndex === -1 || emailIndex === -1) {
        // Instead of alert, throw an error or return an error message in HTML
        throw new Error('CSV must contain columns: first_name, last_name, email');
    }

    return lines.slice(1).map((line, index) => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        return {
            id: `row-${index}-${Date.now()}`, // Simple unique ID
            firstName: values[firstNameIndex] || '',
            lastName: values[lastNameIndex] || '',
            email: values[emailIndex] || ''
        };
    }).filter(p => p.firstName && p.lastName && p.email);
}


const app = new Hono<{ Bindings: Env }>();

// Simple HTML renderer middleware (or use Hono's built-in JSX renderer)
const Layout = (props: { title: string; children?: any }) => (
    <html>
        <head>
            <meta charSet="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>{props.title}</title>
            <script src="https://unpkg.com/htmx.org@1.9.10" integrity="sha384-D1Kt99CQMDuVetoL1lrYwg5t+9QdHe7NLX/SoJYkXDFfX37iInKRy5xLSi8nO7UC" crossOrigin="anonymous"></script>
            <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet" /> {/* Or your project's CSS */}
            <style>{`
                .htmx-settling tr { opacity: 0.5; transition: opacity 300ms ease-out; }
                .sticky-header th { position: sticky; top: 0; z-index: 10; background-color: #f3f4f6 /* bg-gray-100 */; }
            `}</style>
        </head>
        <body class="bg-gray-50 p-4">
            {props.children}
            <script>
              {/* Intersection Observer Logic will go here (or in a separate script tag) */}
            </script>
        </body>
    </html>
);


// Endpoint to render the initial table from CSV
app.post('/upload-table', async (c) => {
    try {
        const formData = await c.req.formData();
        const file = formData.get('csvFile') as File;
        if (!file || typeof file === 'string') {
            return c.html(<div class="text-red-500 p-2">CSV file is required</div>, 400);
        }
        const csvText = await file.text();
        const records = parseCSVText(csvText);

        if (records.length === 0) {
            return c.html(<div class="text-yellow-500 p-2">No valid records found in CSV.</div>);
        }

        const tableHtml = (
            <div class="overflow-x-auto mt-4 border rounded shadow">
                <table class="min-w-full bg-white">
                    <thead class="bg-gray-100 sticky-header">
                        <tr>
                            <th class="py-2 px-3 border-b text-left">First Name</th>
                            <th class="py-2 px-3 border-b text-left">Last Name</th>
                            <th class="py-2 px-3 border-b text-left">Email</th>
                            <th class="py-2 px-3 border-b text-left">Rock Status</th>
                            <th class="py-2 px-3 border-b text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="importer-tbody">
                        {records.map((record) => (
                            <tr id={record.id} class="hover:bg-gray-50 htmx-observe-me">
                                <td class="py-2 px-3 border-b">{record.firstName}</td>
                                <td class="py-2 px-3 border-b">{record.lastName}</td>
                                <td class="py-2 px-3 border-b">{record.email}</td>
                                <td class="py-2 px-3 border-b rock-status-cell" id={`status-${record.id}`}>
                                    <span hx-get={`/api/check-row-status?id=${record.id}&firstName=${encodeURIComponent(record.firstName)}&lastName=${encodeURIComponent(record.lastName)}&email=${encodeURIComponent(record.email)}`}
                                          hx-trigger="revealed once" 
                                          hx-target={`#status-${record.id}`}
                                          hx-swap="innerHTML">
                                        <svg class="animate-spin h-5 w-5 text-gray-500 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    </span>
                                
                                </td>
                                <td class="py-2 px-3 border-b">
                                    <button 
                                        class="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:bg-gray-400"
                                        hx-post="/api/process-rock-record-htmx"
                                        hx-vals={`{ "id": "${record.id}", "firstName": "${record.firstName}", "lastName": "${record.lastName}", "email": "${record.email}" }`}
                                        hx-target={`#${record.id}`} // Target the whole row
                                        hx-swap="outerHTML" // Replace the whole row with server response
                                    >
                                        Import
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 <p class="p-2 text-sm text-gray-600">Showing {records.length} records. Rock status loads on scroll.</p>
            </div>
        );
        return c.html(tableHtml);

    } catch (e: any) {
        console.error("Error uploading/parsing CSV:", e);
        return c.html(<div class="text-red-500 p-2">Error processing CSV: {e.message}</div>, 500);
    }
});

// Endpoint to check status for a single row (triggered by Intersection Observer -> HTMX)
app.get('/check-row-status', async (c) => {
    const { id, firstName, lastName, email } = c.req.query();
    if (!firstName || !lastName || !email) {
        return c.html(`<span class="text-red-500">Missing data</span>`, 400);
    }

    try {
        // Add a small artificial delay to simulate network and see loading spinners
        // await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
        const person = await findPersonInRock(c.env, firstName, lastName, email);
        if (person) {
            return c.html(`<span class="text-green-600" title="Rock ID: ${person.Id}">Exists ✓</span>`);
        } else {
            return c.html(`<span class="text-blue-500">Not Found</span>`);
        }
    } catch (e: any) {
        console.error("Error checking Rock status:", e);
        return c.html(`<span class="text-red-500" title="${e.message}">Error</span>`);
    }
});


// Endpoint to process a record and return the updated row HTML
app.post('/process-rock-record-htmx', async (c) => {
    const { id, firstName, lastName, email } = await c.req.parseBody() as { id: string, firstName: string, lastName: string, email: string };
    
    let statusHtml = '';
    let buttonText = 'Import';
    let buttonDisabled = false;
    let rockPersonId: number | undefined;

    try {
        const existingRockPerson = await findPersonInRock(c.env, firstName, lastName, email);
        if (existingRockPerson) {
            await updatePersonAttributeInRock(c.env, existingRockPerson.Id);
            rockPersonId = existingRockPerson.Id;
            statusHtml = `<span class="text-purple-600" title="Rock ID: ${rockPersonId}">Updated ✓</span>`;
            buttonText = 'Updated';
            buttonDisabled = true;
        } else {
            // const newRockPerson = await createPersonInRock(c.env, firstName, lastName, email);
            // rockPersonId = newRockPerson.Id;
            // statusHtml = `<span class="text-green-700" title="Rock ID: ${rockPersonId}">Created ✓</span>`;
            // buttonText = 'Created';
            // buttonDisabled = true;
        }
    } catch (e: any) {
        console.error("Error processing Rock record:", e);
        statusHtml = `<span class="text-red-600" title="${e.message}">Process Error!</span>`;
        buttonText = 'Retry Import';
    }

    // Return the entire updated row
    return c.html(
        <tr id={id} class={`hover:bg-gray-50 ${buttonDisabled ? 'bg-green-50' : ''} htmx-observe-me`}>
            <td class="py-2 px-3 border-b">{firstName}</td>
            <td class="py-2 px-3 border-b">{lastName}</td>
            <td class="py-2 px-3 border-b">{email}</td>
            <td class="py-2 px-3 border-b rock-status-cell" id={`status-${id}`}>{statusHtml}</td>
            <td class="py-2 px-3 border-b">
                <button 
                    class={`px-3 py-1 text-white text-sm rounded ${buttonDisabled ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'}`}
                    hx-post="/api/process-rock-record-htmx"
                    hx-vals={`{ "id": "${id}", "firstName": "${firstName}", "lastName": "${lastName}", "email": "${email}" }`}
                    hx-target={`#${id}`}
                    hx-swap="outerHTML"
                    disabled={buttonDisabled}
                >
                    {buttonText}
                </button>
            </td>
        </tr>
    );
});


export default app;