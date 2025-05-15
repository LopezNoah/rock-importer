// src/server/index.tsx
import { Hono } from 'hono';
import { html, raw } from 'hono/html';
import apiApp from './api'; // Your Hono app from api.ts
import type { Env } from './rock-service';

const app = new Hono<{ Bindings: Env }>();

// Define a layout component for the main page
interface MainLayoutProps {
  title: string;
  children: any; // Hono/JSX children
}

const LayoutScript = () => (
    raw`
    function observeTableRows() {
        const observerOptions = {
            root: null, 
            rootMargin: '100px 0px 100px 0px', 
            threshold: 0.01 
        };

        const observerCallback = (entries, observerInstance) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Trigger for status check
                    const statusSpan = entry.target.querySelector('.rock-status-cell > span[hx-trigger="revealed once"]');
                    if (statusSpan && statusSpan.hasAttribute('hx-trigger')) { 
                        htmx.trigger(statusSpan, 'revealed');
                        // HTMX 'once' should handle not re-triggering. No need to remove attribute manually here.
                    }

                    // Trigger for auto-processing in action cell
                    const actionProcessSpan = entry.target.querySelector('.action-cell > span[hx-trigger="revealed once"]');
                    if (actionProcessSpan && actionProcessSpan.hasAttribute('hx-trigger')) {
                        htmx.trigger(actionProcessSpan, 'revealed');
                    }
                }
            });
        };

        const observer = new IntersectionObserver(observerCallback, observerOptions);
        const targets = document.querySelectorAll('.htmx-observe-me'); 
        targets.forEach(target => observer.observe(target));
    }
    
    // Initial call for already visible elements if any (though usually table is loaded by HTMX)
    // observeTableRows(); // Might not be needed if table is always dynamically loaded

    document.body.addEventListener('htmx:afterSwap', function(event) {
        // Check if the swapped content is the table container or part of it
        if (event.detail.target.id === 'table-container' || event.target.closest('#table-container')) {
            observeTableRows();
        }
    });

    // afterSettle is also good for when content is added and settled.
    document.body.addEventListener('htmx:afterSettle', function(event) {
        const targetElement = event.detail.elt;
        // If a row itself was swapped, or content inside importer-tbody
        if (targetElement.classList.contains('htmx-observe-me') || targetElement.closest('#importer-tbody')) {
            observeTableRows(); 
        }
    });`
)

const MainLayout = (props: MainLayoutProps) => (
  <html lang="en">
  <head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{props.title}</title>
      <script src="https://unpkg.com/htmx.org@1.9.10" integrity="sha384-D1Kt99CQMDuVetoL1lrYwg5t+9QdHe7NLX/SoJYkXDFfX37iInKRy5xLSi8nO7UC" crossOrigin="anonymous"></script>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet" />
      <style>{`
          .htmx-indicator { display: none; }
          .htmx-request .htmx-indicator { display: inline; }
          /* .htmx-settling td { opacity: 0.7; } */ /* Can make things look jumpy with auto-scroll actions */
          .sticky-header th { position: sticky; top: 0; z-index: 10; background-color: #f3f4f6 /* bg-gray-100 */; }
          .action-cell .animate-spin, .rock-status-cell .animate-spin { margin-right: 0.5rem; }
      `}</style>
  </head>
  <body class="bg-gray-50 p-6 font-sans">
      {props.children}
      <script>{LayoutScript()}</script>
  </body>
  </html>
);

// Serve the main HTML page using the layout
app.get('/', (c) => {
    return c.html(
        <MainLayout title="Rock RMS CSV Importer (HTMX Auto-Scroll)">
            <div class="container mx-auto max-w-4xl">
                <h1 class="text-3xl font-bold mb-6 text-gray-800">Rock RMS CSV Importer (HTMX Auto-Scroll)</h1>
                
                <form 
                    hx-post="/api/upload-table" 
                    hx-target="#table-container" 
                    hx-swap="innerHTML"
                    hx-encoding="multipart/form-data"
                    class="mb-8 p-6 bg-white border rounded-lg shadow"
                >
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4 mb-4">
                        <div>
                            <label for="firstNameHeader" class="block text-sm font-medium text-gray-700">First Name Header</label>
                            <input type="text" name="firstNameHeader" id="firstNameHeader" defaultValue="first_name" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div>
                            <label for="lastNameHeader" class="block text-sm font-medium text-gray-700">Last Name Header</label>
                            <input type="text" name="lastNameHeader" id="lastNameHeader" defaultValue="last_name" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div>
                            <label for="emailHeader" class="block text-sm font-medium text-gray-700">Email Header</label>
                            <input type="text" name="emailHeader" id="emailHeader" defaultValue="email" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4 mb-4">
                        <div>
                            <label for="attributeKey" class="block text-sm font-medium text-gray-700">Attribute Key</label>
                            <input type="text" name="attributeKey" id="attributeKey" defaultValue="ImportSource" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div>
                            <label for="attributeValue" class="block text-sm font-medium text-gray-700">Attribute Value</label>
                            <input type="text" name="attributeValue" id="attributeValue" defaultValue="CSVImport_UI_AutoScroll" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                    </div>

                    <div class="mb-4">
                        <label for="csvFile" class="block text-sm font-medium text-gray-700 mb-1">
                            Upload CSV File (ensure headers match those defined above)
                        </label>
                        <div class="flex items-center space-x-2">
                            <input 
                                type="file" 
                                name="csvFile" 
                                id="csvFile" 
                                accept=".csv" 
                                required
                                class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                            />
                            <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
                                Load Table
                                <span class="htmx-indicator ml-2">
                                    <svg class="animate-spin h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </span>
                            </button>
                        </div>
                    </div>
                </form>

                <div id="table-container" class="mt-4">
                    {/* Table will be loaded here by HTMX */}
                </div>
            </div>
        </MainLayout>
    );
});

// Mount the API routes
app.route('/api', apiApp);

export default app;