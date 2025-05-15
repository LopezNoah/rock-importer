// src/server/api.ts
import { Hono } from 'hono';
import { html, raw } from 'hono/html'; // Import raw for direct HTML rendering if needed
import type { Env, RockPerson } from './rock-service';
import { createPersonInRock, findPersonInRock, updatePersonAttributeInRock } from './rock-service';
import { z } from 'zod';
import { validator } from 'hono/validator';

interface CsvRowData {
    id: string; 
    firstName: string;
    lastName: string;
    email: string;
}

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
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        return {
            id: `row-${index}-${Date.now()}-${Math.random().toString(36).substring(2,7)}`, // More robust ID
            firstName: values[firstNameIndex] || '',
            lastName: values[lastNameIndex] || '',
            email: values[emailIndex] || ''
        };
    }).filter(p => p.firstName && p.lastName && p.email);
}

const app = new Hono<{ Bindings: Env }>();

const Spinner = () => html`
    <svg class="animate-spin h-5 w-5 text-gray-500 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
`;

app.post('/upload-table', async (c) => {
    try {
        const formData = await c.req.formData();
        const file = formData.get('csvFile') as File;
        const firstNameHeader = (formData.get('firstNameHeader') as string || 'first_name').trim();
        const lastNameHeader = (formData.get('lastNameHeader') as string || 'last_name').trim();
        const emailHeader = (formData.get('emailHeader') as string || 'email').trim();
        const attributeKey = (formData.get('attributeKey') as string || '').trim();
        const attributeValue = (formData.get('attributeValue') as string || '').trim();

        if (!file || typeof file === 'string') return c.html(<div class="text-red-500 p-2">CSV file is required.</div>, 400);
        if (!firstNameHeader || !lastNameHeader || !emailHeader) return c.html(<div class="text-red-500 p-2">CSV header keys for First Name, Last Name, and Email are required.</div>, 400);
        if (!attributeKey || !attributeValue) return c.html(<div class="text-red-500 p-2">Attribute Key and Attribute Value are required.</div>, 400);

        const csvText = await file.text();
        const records = parseCSVText(csvText, firstNameHeader, lastNameHeader, emailHeader);

        if (records.length === 0) return c.html(<div class="text-yellow-500 p-2">No valid records found. Check headers and content.</div>);

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
                                    <span hx-get={`/api/check-row-status?firstName=${encodeURIComponent(record.firstName)}&lastName=${encodeURIComponent(record.lastName)}&email=${encodeURIComponent(record.email)}`}
                                          hx-trigger="revealed once" 
                                          hx-target="this"
                                          hx-swap="innerHTML">
                                        <Spinner /> Checking...
                                    </span>
                                </td>
                                <td class="py-2 px-3 border-b action-cell" id={`action-${record.id}`}>
                                    <span
                                        hx-post="/api/process-rock-record-htmx"
                                        hx-vals={JSON.stringify({ // Ensure hx-vals are properly stringified JSON
                                            id: record.id,
                                            firstName: record.firstName,
                                            lastName: record.lastName,
                                            email: record.email,
                                            attributeKey: attributeKey,
                                            attributeValue: attributeValue
                                        })}
                                        hx-trigger="revealed once"
                                        hx-target={`#${record.id}`} // Target the whole row
                                        hx-swap="outerHTML"
                                    >
                                        <Spinner /> Queued for processing...
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 <p class="p-2 text-sm text-gray-600">Showing {records.length} records. Status check and processing occur on scroll.</p>
            </div>
        );
        return c.html(tableHtml);

    } catch (e: any) {
        console.error("Error uploading/parsing CSV:", e);
        const errorMessage = e.message.includes("CSV header(s) not found") 
                             ? e.message 
                             : "Error processing CSV file.";
        return c.html(<div class="text-red-500 p-2">{errorMessage}</div>, e.message.includes("CSV header(s) not found") ? 400 : 500);
    }
});

app.get('/check-row-status', async (c) => {
    const { firstName, lastName, email } = c.req.query();
    if (!firstName || !lastName || !email) return c.html(`<span class="text-red-500">Missing data</span>`, 400);

    try {
        const person = await findPersonInRock(c.env, firstName, lastName, email);
        if (person) return c.html(`<span class="text-green-600" title="Rock ID: ${person.Id}">Exists ✓</span>`);
        return c.html(`<span class="text-blue-500">Not Found</span>`);
    } catch (e: any) {
        console.error("Error checking Rock status:", e);
        return c.html(`<span class="text-red-500" title="${e.message}">Error</span>`);
    }
});

const processSchema = z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    attributeKey: z.string(),
    attributeValue: z.string()
});

app.post('/process-rock-record-htmx',
    validator('form', (value, c) => {
        const parsed = processSchema.safeParse(value)
        if (!parsed.success) {
            return c.text('<div>Invalid!</div>', 401)
        }
        return parsed.data;
    }),
    async (c) => {
    const { id, firstName, lastName, email, attributeKey, attributeValue } = c.req.valid('form');

    let rockStatusCellContent: any = html`<Spinner /> Processing...`; // Placeholder for status cell
    let actionCellContent: any = html`<Spinner /> Working...`;      // Placeholder for action cell

    try {
        const existingRockPerson = await findPersonInRock(c.env, firstName, lastName, email);
        if (existingRockPerson) {
            await updatePersonAttributeInRock(c.env, existingRockPerson.Id, attributeKey, attributeValue);
            rockStatusCellContent = html`<span class="text-green-600" title="Rock ID: ${existingRockPerson.Id}">Exists ✓</span>`;
            actionCellContent = html`<span class="text-purple-600">Updated: ${attributeKey}=${attributeValue} (ID: ${existingRockPerson.Id})</span>`;
        } else {
            const newPerson: RockPerson = await createPersonInRock(c.env, firstName, lastName, email, attributeKey, attributeValue);
            rockStatusCellContent = html`<span class="text-green-600" title="Rock ID: ${newPerson.Id}">Exists ✓ (New)</span>`;
            actionCellContent = html`<span class="text-green-600">Created: ${attributeKey}=${attributeValue} (ID: ${newPerson.Id})</span>`;
        }
    } catch (e: any) {
        console.error(`Error processing Rock record for ${id}:`, e);
        // Attempt to get current rock status even on error
        try {
            const currentStatus = await findPersonInRock(c.env, firstName, lastName, email);
            if (currentStatus) {
                rockStatusCellContent = html`<span class="text-green-600" title="Rock ID: ${currentStatus.Id}">Exists ✓</span>`;
            } else {
                rockStatusCellContent = html`<span class="text-blue-500">Not Found</span>`;
            }
        } catch (statusError: any) {
             rockStatusCellContent = html`<span class="text-yellow-500" title="${statusError.message}">Status Unknown</span>`;
        }
        
        actionCellContent = html`
            <div class="flex flex-col items-start">
                <span class="text-red-600" title="${e.message}">Process Error!</span>
                <button 
                    class="mt-1 px-2 py-1 text-white text-xs rounded bg-red-500 hover:bg-red-600"
                    hx-post="/api/process-rock-record-htmx"
                    hx-vals=${JSON.stringify({ // Ensure hx-vals are properly stringified JSON
                        id: id,
                        firstName: firstName,
                        lastName: lastName,
                        email: email,
                        attributeKey: attributeKey,
                        attributeValue: attributeValue
                    })}
                    hx-target="#${id}"
                    hx-swap="outerHTML"
                >
                    Retry
                </button>
            </div>
        `;
    }

    return c.html(
        <tr id={id} class="hover:bg-gray-50 htmx-observe-me">
            <td class="py-2 px-3 border-b">{firstName}</td>
            <td class="py-2 px-3 border-b">{lastName}</td>
            <td class="py-2 px-3 border-b">{email}</td>
            <td class="py-2 px-3 border-b rock-status-cell" id={`status-${id}`}>{rockStatusCellContent}</td>
            <td class="py-2 px-3 border-b action-cell" id={`action-${id}`}>{actionCellContent}</td>
        </tr>
    );
});

export default app;