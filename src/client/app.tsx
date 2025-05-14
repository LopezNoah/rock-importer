// // src/client/app.tsx
// "use client" // If using Next.js App Router

// import React, { useState, useEffect, useRef, FormEvent, ChangeEvent, Suspense, useCallback } from 'react';
// import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// import { useInView } from 'react-intersection-observer'; // From the library

// // Type definitions
// interface CsvPersonData {
//     firstName: string;
//     lastName: string;
//     email: string;
// }

// interface CsvPersonState extends CsvPersonData {
//     id: string; // Unique client-side ID

//     // Existence check status
//     existenceCheckStatus: 'idle' | 'checking' | 'checked_exists' | 'checked_not_found' | 'checked_error';
//     rockPersonId?: number | null;
//     existenceCheckMessage?: string | null;

//     // For the main import/update process
//     processingStatus: 'idle' | 'processing' | 'success' | 'error';
//     processingMessage?: string | null;
//     finalRockPersonId?: number | null;
// }

// interface BatchExistenceRequestItem {
//     id: string;
//     firstName: string;
//     lastName: string;
//     email: string;
// }

// interface BatchExistenceResultItem {
//     id: string;
//     exists: boolean;
//     rockPersonId?: number;
//     rockFirstName?: string;
//     rockLastName?: string;
//     rockEmail?: string;
//     error?: string;
// }

// // API call for BATCH checking existence
// const batchCheckRockExistenceAPI = async (
//     persons: BatchExistenceRequestItem[]
// ): Promise<BatchExistenceResultItem[]> => {
//     if (!persons || persons.length === 0) return [];
//     const response = await fetch('/api/batch-check-rock-existence', { // Ensure this endpoint exists
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(persons),
//     });
//     if (!response.ok) {
//         const errorData: any = await response.json().catch(() => ({ error: 'Network error or non-JSON response from batch check' }));
//         throw new Error(errorData.error || `Server error during batch check: ${response.status}`);
//     }
//     return response.json();
// };

// // API call for processing (create/update) - remains the same
// const processRockRecordAPI = async (person: CsvPersonData): Promise<{
//     message: string;
//     rockPersonId?: number;
//     action: 'created' | 'updated' | 'error';
//     processedData: CsvPersonData;
// }> => {
//     // ... (Implementation from previous versions)
//     const response = await fetch("/api/process-rock-record", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(person),
//     });
//     if (!response.ok) {
//         const errorData = await response.json().catch(() => ({ error: "Network error or non-JSON response" }));
//         throw new Error((errorData as { error?: string }).error || `Server error: ${response.status}`);
//     }
//     return response.json();
// };

// // Basic CSV parser (using 'first_name', 'last_name' as per your last example)
// function parseCSV(csvText: string): Array<CsvPersonData> {
//     const lines = csvText.trim().split(/\r?\n/);
//     if (lines.length < 2) return [];
//     const headerLine = lines[0].toLowerCase();
//     const headers = headerLine.split(',').map(h => h.trim());
//     const firstNameIndex = headers.indexOf('first_name');
//     const lastNameIndex = headers.indexOf('last_name');
//     const emailIndex = headers.indexOf('email');

//     if (firstNameIndex === -1 || lastNameIndex === -1 || emailIndex === -1) {
//         alert('CSV must contain columns: first_name, last_name, email (case-insensitive headers).');
//         throw new Error('CSV header mismatch');
//     }
//     return lines.slice(1).map(line => {
//         const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
//         return {
//             firstName: values[firstNameIndex] || '',
//             lastName: values[lastNameIndex] || '',
//             email: values[emailIndex] || ''
//         };
//     }).filter(p => p.firstName && p.lastName && p.email);
// }

// const BATCH_SIZE = 50; // How many records to check for existence in one go

// // --- PersonRow Component ---
// // This component is now simpler, mostly for display and triggering individual actions.
// // The IntersectionObserver for triggering batch loads will be higher up.
// interface PersonRowProps {
//     person: CsvPersonState;
//     onProcess: (personData: CsvPersonData) => Promise<void>;
// }

// const PersonRow: React.FC<PersonRowProps> = React.memo(({ person, onProcess }) => {
//     const existenceStatusDisplay = () => {
//         switch (person.existenceCheckStatus) {
//             case 'idle': return <span className="text-gray-400">Pending check...</span>;
//             case 'checking': return <span className="text-yellow-500">Checking...</span>;
//             case 'checked_exists': return <span className="text-green-600" title={`Rock ID: ${person.rockPersonId}`}>Exists ✓</span>;
//             case 'checked_not_found': return <span className="text-blue-500">Not Found</span>;
//             case 'checked_error': return <span className="text-red-500" title={person.existenceCheckMessage || ""}>Error</span>;
//             default: return <span className="text-gray-400">-</span>;
//         }
//     };

//     const getProcessingStatusStyles = (status: CsvPersonState['processingStatus']) => {
//         switch (status) {
//             case 'success': return 'text-green-600 font-semibold';
//             case 'processing': return 'text-yellow-600';
//             case 'error': return 'text-red-600 font-semibold';
//             default: return 'text-gray-500';
//         }
//     };
    
//     return (
//         <tr className="hover:bg-gray-50">
//             <td className="py-2 px-3 border-b">{person.firstName}</td>
//             <td className="py-2 px-3 border-b">{person.lastName}</td>
//             <td className="py-2 px-3 border-b">{person.email}</td>
//             <td className="py-2 px-3 border-b">{existenceStatusDisplay()}</td>
//             <td className={`py-2 px-3 border-b ${getProcessingStatusStyles(person.processingStatus)}`}>
//                 {person.processingStatus !== 'idle' ? person.processingStatus.toUpperCase() : '-'}
//             </td>
//             <td className="py-2 px-3 border-b text-sm">
//                 {person.processingMessage || (person.finalRockPersonId ? `Rock ID: ${person.finalRockPersonId}` : '')}
//             </td>
//             <td className="py-2 px-3 border-b">
//                 <button
//                     onClick={() => onProcess({ firstName: person.firstName, lastName: person.lastName, email: person.email })}
//                     disabled={
//                         person.processingStatus === 'processing' ||
//                         person.processingStatus === 'success' ||
//                         person.existenceCheckStatus === 'checking' ||
//                         person.existenceCheckStatus === 'idle' // Wait for check to complete
//                     }
//                     className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:bg-gray-400"
//                 >
//                     {person.processingStatus === 'error' ? 'Retry Import' :
//                      (person.processingStatus === 'idle' ? (person.existenceCheckStatus === 'checked_exists' ? 'Update Attr.' : 'Import New') : 'Processing...')}
//                 </button>
//             </td>
//         </tr>
//     );
// });
// PersonRow.displayName = 'PersonRow';


// // --- App Component ---
// const App = () => {
//     const [allPersons, setAllPersons] = useState<CsvPersonState[]>([]);
//     const [file, setFile] = useState<File | null>(null);
//     const [isParsing, setIsParsing] = useState(false);
//     const [overallMessage, setOverallMessage] = useState<string | null>(null);
//     const queryClient = useQueryClient();

//     // This ref is for the "load more" trigger at the bottom of the list
//     const { ref: loadMoreRef, inView: loadMoreInView } = useInView({
//         threshold: 0.5,
//         rootMargin: "200px", // Trigger a bit before it's fully visible
//     });
    
//     const [processedIndex, setProcessedIndex] = useState(0); // Tracks how many records' existence has been initiated for checking

//     // TanStack Query for batch existence check
//     const batchExistenceQuery = useQuery({
//         queryKey: ['batchRockExistence', processedIndex], // Key changes when more items are processed
//         queryFn: async () => {
//             const itemsToFetch = allPersons
//                 .slice(processedIndex, processedIndex + BATCH_SIZE)
//                 .filter(p => p.existenceCheckStatus === 'idle' || p.existenceCheckStatus === 'checking');

//             if (itemsToFetch.length === 0) {
//                 return null; // No new items to fetch for this "page"
//             }
            
//             // Optimistically mark as 'checking'
//             setAllPersons(prev => prev.map(p => 
//                 itemsToFetch.find(itf => itf.id === p.id) ? { ...p, existenceCheckStatus: 'checking' } : p
//             ));
            
//             return batchCheckRockExistenceAPI(itemsToFetch.map(p => ({
//                 id: p.id,
//                 firstName: p.firstName,
//                 lastName: p.lastName,
//                 email: p.email,
//             })));
//         },
//         enabled: processedIndex < allPersons.length && allPersons.length > 0, // Enable if there are more persons to process
//         keepPreviousData: true, // Useful for pagination-like behavior
//         onSuccess: (batchResults) => {
//             if (!batchResults) return;

//             setAllPersons(prevPersons => {
//                 const resultsMap = new Map(batchResults.map(r => [r.id, r]));
//                 return prevPersons.map(p => {
//                     const result = resultsMap.get(p.id);
//                     if (result) {
//                         return {
//                             ...p,
//                             existenceCheckStatus: result.error ? 'checked_error' : (result.exists ? 'checked_exists' : 'checked_not_found'),
//                             rockPersonId: result.rockPersonId,
//                             existenceCheckMessage: result.error || (result.exists ? `Rock ID: ${result.rockPersonId}` : null),
//                         };
//                     }
//                     return p;
//                 });
//             });
//             // overallMessage can be updated here if needed
//         },
//         onError: (error: Error) => {
//             setOverallMessage(`Batch Existence Check Failed: ${error.message}`);
//             // Mark items that were 'checking' in this failed batch as 'checked_error'
//             const itemsInFailedBatch = allPersons.slice(processedIndex, processedIndex + BATCH_SIZE);
//             setAllPersons(prevPersons => prevPersons.map(p => 
//                 itemsInFailedBatch.find(ifb => ifb.id === p.id && p.existenceCheckStatus === 'checking') 
//                 ? { ...p, existenceCheckStatus: 'checked_error', existenceCheckMessage: error.message } 
//                 : p
//             ));
//         },
//     });

//     // Effect to trigger fetching next batch when "loadMoreRef" is in view
//     useEffect(() => {
//         if (loadMoreInView && !batchExistenceQuery.isLoading && processedIndex < allPersons.length) {
//             // console.log(`Load more in view. Current processedIndex: ${processedIndex}, total: ${allPersons.length}`);
//             setProcessedIndex(prev => Math.min(prev + BATCH_SIZE, allPersons.length));
//         }
//     }, [loadMoreInView, batchExistenceQuery.isLoading, processedIndex, allPersons.length]);


//     const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
//         if (event.target.files && event.target.files[0]) {
//             setFile(event.target.files[0]);
//             setOverallMessage(null);
//             setAllPersons([]);
//             setProcessedIndex(0);
//             queryClient.removeQueries({ queryKey: ['batchRockExistence'] });
//         }
//     };

//     const handleFileUpload = async (event: FormEvent) => {
//         event.preventDefault();
//         if (!file) {
//             setOverallMessage('Please select a CSV file.');
//             return;
//         }
//         setIsParsing(true);
//         setOverallMessage('Parsing CSV...');

//         const reader = new FileReader();
//         reader.onload = (e) => {
//             try {
//                 const text = e.target?.result as string;
//                 const parsedData = parseCSV(text);
//                 setAllPersons(parsedData.map((p, index) => ({
//                     ...p,
//                     id: `${Date.now()}-${index}-${Math.random().toString(36).substring(2,7)}`,
//                     existenceCheckStatus: 'idle',
//                     processingStatus: 'idle',
//                 })));
//                 setProcessedIndex(0); // Reset for new file, will trigger initial batch
//                 setOverallMessage(`Parsed ${parsedData.length} records. Checking existence in batches...`);
//                 // The useEffect watching loadMoreInView and processedIndex will trigger the first batch if BATCH_SIZE < total
//                 // Or the batchExistenceQuery.enabled condition will trigger it.
//                 // To ensure the first batch loads immediately if conditions are met:
//                 if (parsedData.length > 0) {
//                    // queryClient.refetchQueries(['batchRockExistence', 0]); // this might be too eager
//                    // The enabled flag and processedIndex state should handle it.
//                 }

//             } catch (error: any) {
//                 setOverallMessage(`Error parsing CSV: ${error.message}`);
//                 setAllPersons([]);
//             } finally {
//                 setIsParsing(false);
//             }
//         };
//         reader.onerror = () => {
//             setOverallMessage('Error reading file.');
//             setIsParsing(false);
//         };
//         reader.readAsText(file);
//     };

//     // Mutation for processing a single person (create/update)
//     const processPersonMutation = useMutation({
//         mutationFn: processRockRecordAPI,
//         onMutate: async (personToProcess: CsvPersonData & { id: string }) => {
//             setAllPersons(prev => prev.map(p =>
//                 p.id === personToProcess.id ? { ...p, processingStatus: 'processing', processingMessage: null } : p
//             ));
//         },
//         onSuccess: (data, variables) => {
//             setAllPersons(prev => prev.map(p => {
//                 if (p.id === (variables as CsvPersonData & {id: string}).id) {
//                     return {
//                         ...p,
//                         processingStatus: 'success',
//                         processingMessage: data.message,
//                         finalRockPersonId: data.rockPersonId,
//                         // Update existence status as well
//                         existenceCheckStatus: data.action === 'created' || data.action === 'updated' ? 'checked_exists' : p.existenceCheckStatus,
//                         rockPersonId: data.action === 'created' || data.action === 'updated' ? data.rockPersonId : p.rockPersonId,
//                     };
//                 }
//                 return p;
//             }));
//         },
//         onError: (error: Error, variables) => {
//             setAllPersons(prev => prev.map(p =>
//                 p.id === (variables as CsvPersonData & {id: string}).id ? { ...p, processingStatus: 'error', processingMessage: error.message } : p
//             ));
//         },
//     });

//     const handleProcessPerson = useCallback(async (personData: CsvPersonData) => {
//         const personToProcess = allPersons.find(p => p.email === personData.email && p.firstName === personData.firstName && p.lastName === personData.lastName);
//         if (personToProcess) {
//             await processPersonMutation.mutateAsync({ ...personData, id: personToProcess.id });
//         }
//     }, [allPersons, processPersonMutation]);
    
//     const currentlyVisiblePersons = allPersons.slice(0, processedIndex + BATCH_SIZE); // Display up to what's being processed + next batch

//     return (
//         <div className="container mx-auto p-4">
//             <h1 className="text-2xl font-bold mb-4">Rock RMS CSV Importer (Fast Batch Checks)</h1>

//             <form onSubmit={handleFileUpload} className="mb-6 p-4 border rounded shadow">
//                 <div className="mb-4">
//                     <label htmlFor="csvFileClient" className="block text-sm font-medium text-gray-700 mb-1">
//                         Upload CSV (headers: first_name, last_name, email)
//                     </label>
//                     <input
//                         type="file" id="csvFileClient" accept=".csv" onChange={handleFileChange}
//                         className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
//                     />
//                 </div>
//                 <button
//                     type="submit" disabled={isParsing || !file}
//                     className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded disabled:bg-gray-400"
//                 >
//                     {isParsing ? "Parsing..." : "Load & Check CSV"}
//                 </button>
//             </form>

//             {overallMessage && (
//                 <div className={`p-3 mb-4 rounded ${overallMessage.toLowerCase().includes('error') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
//                     {overallMessage}
//                 </div>
//             )}

//             {allPersons.length > 0 && (
//                 <>
//                     <div className="flex justify-between items-center mb-4">
//                         <h2 className="text-xl font-semibold">
//                             Records ({allPersons.filter(p=>p.existenceCheckStatus !== 'idle' && p.existenceCheckStatus !== 'checking').length} / {allPersons.length} checked)
//                         </h2>
//                         {batchExistenceQuery.isLoading && <div className="text-sm text-blue-500">Loading next batch...</div>}
//                     </div>

//                     <div className="overflow-x-auto max-h-[70vh] overflow-y-auto"> {/* Scrollable Table */}
//                         <table className="min-w-full bg-white border">
//                             <thead className="bg-gray-100 sticky top-0 z-10">
//                                 <tr>
//                                     <th className="py-2 px-3 border-b text-left">First Name</th>
//                                     <th className="py-2 px-3 border-b text-left">Last Name</th>
//                                     <th className="py-2 px-3 border-b text-left">Email</th>
//                                     <th className="py-2 px-3 border-b text-left">Rock Status</th>
//                                     <th className="py-2 px-3 border-b text-left">Import Status</th>
//                                     <th className="py-2 px-3 border-b text-left">Details</th>
//                                     <th className="py-2 px-3 border-b text-left">Actions</th>
//                                 </tr>
//                             </thead>
//                             <tbody>
//                                 {allPersons.map((person, index) => (
//                                     // Only render rows that are part of the "virtualized" window or have been processed
//                                     // A true virtualized list is better, but this is a simpler approach
//                                     (index < processedIndex + BATCH_SIZE * 2) && // Render a bit more than strictly processed for smoother scroll
//                                     <PersonRow
//                                         key={person.id}
//                                         person={person}
//                                         onProcess={handleProcessPerson}
//                                     />
//                                 ))}
//                                 {/* Load More Trigger - only if there are more items than currently processed */}
//                                 {processedIndex < allPersons.length && (
//                                     <tr>
//                                         <td colSpan={7} ref={loadMoreRef} className="p-4 text-center">
//                                             {batchExistenceQuery.isLoading ? 'Loading more records...' : 'Scroll to load more...'}
//                                         </td>
//                                     </tr>
//                                 )}
//                             </tbody>
//                         </table>
//                     </div>
//                 </>
//             )}
//         </div>
//     );
// };

// const SuspenseWrappedApp = () => (
//     <Suspense fallback={"loading page..."}>
//         <App />
//     </Suspense>
// );


// import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
// import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

// // Create a client
// const queryClient = new QueryClient()

// export default function Home() {
//   return (
//     <QueryClientProvider client={queryClient}>
//       <SuspenseWrappedApp />
//       <ReactQueryDevtools initialIsOpen={false} />
//     </QueryClientProvider>
//   )
// }

// // export default SuspenseWrappedApp;