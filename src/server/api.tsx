// src/server/api.ts
import { Hono } from 'hono';
// Removed unused imports: stream, jsxRenderer
import type { Env } from './rock-service';
import { createPersonInRock, findPersonInRock, updatePersonAttributeInRock /* createPersonInRock */ } from './rock-service'; // Assuming createPersonInRock might be used later

// CSV Row Data interface remains the same
interface CsvRowData {
    id: string; // Unique ID for HTMX targeting
    firstName: string;
    lastName: string;
    email: string;
}

// Updated parseCSVText to accept dynamic header keys
function parseCSVText(
    csvText: string,
    firstNameHeaderKey: string,
    lastNameHeaderKey: string,
    emailHeaderKey: string
): CsvRowData[] {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const csvHeaders = lines[0].split(',').map(h => h.trim());
    
    const findHeaderIndex = (key: string, availableHeaders: string[]) => {
        const lowerKey = key.toLowerCase();
        return availableHeaders.findIndex(h => h.toLowerCase() === lowerKey);
    };

    const firstNameIndex = findHeaderIndex(firstNameHeaderKey, csvHeaders);
    const lastNameIndex = findHeaderIndex(lastNameHeaderKey, csvHeaders);
    const emailIndex = findHeaderIndex(emailHeaderKey, csvHeaders);

    const missingHeaders: string[] = [];
    if (firstNameIndex === -1) missingHeaders.push(firstNameHeaderKey);
    if (lastNameIndex === -1) missingHeaders.push(lastNameHeaderKey);
    if (emailIndex === -1) missingHeaders.push(emailHeaderKey);

    if (missingHeaders.length > 0) {
        throw new Error(`CSV header(s) not found: '${missingHeaders.join("', '")}'. Available headers: ${csvHeaders.join(', ')}`);
    }

    return lines.slice(1).map((line, index) => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, '')); // Remove surrounding quotes
        return {
            id: `row-${index}-${Date.now()}`, // Simple unique ID
            firstName: values[firstNameIndex] || '',
            lastName: values[lastNameIndex] || '',
            email: values[emailIndex] || ''
        };
    }).filter(p => p.firstName && p.lastName && p.email); // Basic validation: ensure essential fields are present
}


const app = new Hono<{ Bindings: Env }>();

// The Layout component previously here was not used by HTMX partials and can be removed.
// HTMX partials are injected into the main page which already has its own layout.

// Endpoint to render the initial table from CSV
app.post('/upload-table', async (c) => {
    try {
        const formData = await c.req.formData();
        const file = formData.get('csvFile') as File;

        // Get header keys from form data, with defaults (though UI now makes them required)
        const firstNameHeader = (formData.get('firstNameHeader') as string || 'first_name').trim();
        const lastNameHeader = (formData.get('lastNameHeader') as string || 'last_name').trim();
        const emailHeader = (formData.get('emailHeader') as string || 'email').trim();

        if (!file || typeof file === 'string') {
            return c.html(<div class="text-red-500 p-2">CSV file is required.</div>, 400);
        }
        // Basic check, though UI should enforce this
        if (!firstNameHeader || !lastNameHeader || !emailHeader) {
            return c.html(<div class="text-red-500 p-2">CSV header keys for First Name, Last Name, and Email are required.</div>, 400);
        }

        const csvText = await file.text();
        const records = parseCSVText(csvText, firstNameHeader, lastNameHeader, emailHeader);

        if (records.length === 0) {
            return c.html(<div class="text-yellow-500 p-2">No valid records found in CSV, or headers did not match. Please check column names and file content.</div>);
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
                                        hx-target={`#${record.id}`}
                                        hx-swap="outerHTML"
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
        // Provide a more user-friendly error message to the client
        const errorMessage = e.message.includes("CSV header(s) not found") 
                             ? e.message 
                             : "Error processing CSV file. Please ensure it is valid and try again.";
        return c.html(<div class="text-red-500 p-2">{errorMessage}</div>, e.message.includes("CSV header(s) not found") ? 400 : 500);
    }
});

// Endpoint to check status for a single row (triggered by Intersection Observer -> HTMX)
app.get('/check-row-status', async (c) => {
    const { id, firstName, lastName, email } = c.req.query();
    if (!firstName || !lastName || !email) {
        return c.html(`<span class="text-red-500">Missing data</span>`, 400);
    }

    try {
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

app.post('/process-rock-record-htmx', async (c) => {
    const {
        id,
        firstName,
        lastName,
        email,
        attributeKey,
        attributeValue
    } = await c.req.parseBody() as {
        id: string,
        firstName: string,
        lastName: string,
        email: string,
        attributeKey: string,
        attributeValue: string
    };

    let statusHtml = '';
    let buttonText = 'Import';
    let buttonDisabled = false;
    let finalMessage = '';

    try {
        const existingRockPerson = await findPersonInRock(c.env, firstName, lastName, email);
        if (existingRockPerson) {
            await updatePersonAttributeInRock(c.env, existingRockPerson.Id, attributeKey, attributeValue);
            statusHtml = `<span class="text-purple-600" title="Rock ID: ${existingRockPerson.Id}">Updated ✓</span>`;
            buttonText = 'Updated';
            finalMessage = `Attribute '${attributeKey}' set to '${attributeValue}' for ID: ${existingRockPerson.Id}`;
            buttonDisabled = true;
        } else {
            statusHtml = `<span class="text-orange-500">Not Found (Create not enabled)</span>`;
            buttonText = 'Import (N/A)';
            await createPersonInRock(c.env, firstName, lastName, email);
            finalMessage = 'Person not found. Creation logic is currently disabled.';
        }
    } catch (e: any) {
        console.error("Error processing Rock record:", e);
        statusHtml = `<span class="text-red-600" title="${e.message}">Process Error!</span>`;
        finalMessage = `Error: ${e.message}`;
        buttonText = 'Retry Import';
    }

    return c.html(
        <tr id={id} class={`hover:bg-gray-50 ${buttonDisabled ? 'bg-green-50' : ''} htmx-observe-me`}>
            <td class="py-2 px-3 border-b">{firstName}</td>
            <td class="py-2 px-3 border-b">{lastName}</td>
            <td class="py-2 px-3 border-b">{email}</td>
            <td class="py-2 px-3 border-b rock-status-cell" id={`status-${id}`}>{statusHtml} <em class="text-xs text-gray-500">{finalMessage}</em></td>
            <td class="py-2 px-3 border-b">
                <button 
                    class={`px-3 py-1 text-white text-sm rounded ${buttonDisabled ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'}`}
                    hx-post="/api/process-rock-record-htmx"
                    hx-vals={`{
                        "id": "${id}",
                        "firstName": "${firstName}",
                        "lastName": "${lastName}",
                        "email": "${email}",
                        "attributeKey": "${attributeKey}",
                        "attributeValue": "${attributeValue}"
                    }`}
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