// // import { Hono } from 'hono'
// // import { renderer } from './renderer'

// // const app = new Hono()

// // app.get('/api', (c) => {
// //   return c.json({ message: 'Hello from API' })
// // })

// // app.use(renderer)

// // app.get('/', (c) => {
// //   return c.render(
// //     <>
// //       <h1 className="text-3xl font-bold underline">Hello from SSR</h1>
// //       <div id="root"></div>
// //     </>
// //   )
// // })

// // export default app

// // src/server/index.tsx
// import { Hono } from 'hono'
// import { renderer } from './renderer'
// import apiRoutes from './api'
// import type { Env } from './rock-service'; // Import the updated Env type

// const app = new Hono<{ Bindings: Env }>(); // Specify Bindings for Env types

// app.route('/api', apiRoutes);

// app.use(renderer);

// app.get('/', (c) => {
//   return c.render(
//     <>
//       <div id="root"></div>
//     </>
//   )
// })

// export default app

// src/server/index.tsx
import { Hono } from 'hono';
import apiApp from './api'; // Your Hono app from api.ts
import type { Env } from './rock-service';

const app = new Hono<{ Bindings: Env }>();

// Serve the main HTML page
app.get('/', (c) => {
    const initialPageHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Rock RMS CSV Importer (HTMX)</title>
            <script src="https://unpkg.com/htmx.org@1.9.10" integrity="sha384-D1Kt99CQMDuVetoL1lrYwg5t+9QdHe7NLX/SoJYkXDFfX37iInKRy5xLSi8nO7UC" crossorigin="anonymous"></script>
            <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
            <style>
                .htmx-indicator { display: none; }
                .htmx-request .htmx-indicator { display: inline; }
                .htmx-settling td { opacity: 0.7; }
                .sticky-header th { position: sticky; top: 0; z-index: 10; background-color: #f3f4f6 /* bg-gray-100 */; }
            </style>
        </head>
        <body class="bg-gray-50 p-6 font-sans">
            <div class="container mx-auto max-w-4xl">
                <h1 class="text-3xl font-bold mb-6 text-gray-800">Rock RMS CSV Importer (HTMX)</h1>
                
                <form 
                    hx-post="/api/upload-table" 
                    hx-target="#table-container" 
                    hx-swap="innerHTML"
                    hx-encoding="multipart/form-data"
                    class="mb-8 p-6 bg-white border rounded-lg shadow"
                >
                    <label for="csvFile" class="block text-sm font-medium text-gray-700 mb-1">
                        Upload CSV (headers: first_name, last_name, email)
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
                </form>

                <div id="table-container" class="mt-4">
                    <!-- Table will be loaded here by HTMX -->
                </div>
            </div>

            <script>
                // This script needs to run after HTMX might have swapped content.
                // Using htmx.onLoad is a good way to re-apply observers.
                function observeTableRows() {
                    const observerOptions = {
                        root: null, // relative to document viewport
                        rootMargin: '100px 0px 100px 0px', // trigger a bit before/after viewport
                        threshold: 0.01 // trigger if 1% is visible
                    };

                    const observerCallback = (entries, observerInstance) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                const targetCellSpan = entry.target.querySelector('.rock-status-cell > span[hx-trigger="revealed once"]');
                                if (targetCellSpan) {
                                    // Check if HTMX has already processed this due to "once"
                                    // A simple check could be if it still has the hx-trigger attribute,
                                    // or if its content has changed from the spinner.
                                    // For robust "once", HTMX's built-in "once" is preferred.
                                    // If the element isn't found or hx-trigger is gone, it means HTMX handled it or it was already triggered.
                                    if (targetCellSpan.hasAttribute('hx-trigger')) {
                                       htmx.trigger(targetCellSpan, 'revealed');
                                    }
                                }
                                // No need to explicitly unobserve if hx-trigger="... once" is used effectively by HTMX.
                                // If not relying solely on HTMX "once", then: observerInstance.unobserve(entry.target);
                            }
                        });
                    };

                    const observer = new IntersectionObserver(observerCallback, observerOptions);
                    const targets = document.querySelectorAll('.htmx-observe-me'); // Class on <tr>
                    targets.forEach(target => observer.observe(target));
                }

                // Initial call for any static content (though table is dynamic)
                // observeTableRows(); 
                
                // Re-run observer setup after HTMX swaps content into #table-container
                document.body.addEventListener('htmx:afterSwap', function(event) {
                    if (event.detail.target.id === 'table-container' || event.target.closest('#table-container')) {
                        observeTableRows();
                    }
                });

                // Also for individual row swaps if the .htmx-observe-me class is re-added
                 document.body.addEventListener('htmx:afterSettle', function(event) {
                    // Check if the settled element or its parent has the class
                    const targetElement = event.detail.elt;
                    if (targetElement.classList.contains('htmx-observe-me') || (targetElement.parentElement && targetElement.parentElement.classList.contains('htmx-observe-me'))) {
                         // Potentially re-observe if needed, though "once" should handle it.
                         // This might be redundant if "revealed once" works perfectly.
                    }
                });

            </script>
        </body>
        </html>
    `;
    return c.html(initialPageHtml);
});

// Mount the API routes
app.route('/api', apiApp);

export default app;