// // import { createRoot } from 'react-dom/client'
// // import App from './app'

// // const rootElement = document.getElementById('root')
// // if (rootElement) {
// //   const root = createRoot(rootElement)
// //   root.render(<App />)
// // }

// // src/client/index.tsx
// import { createRoot } from 'react-dom/client';
// import App from './app';
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// // Optional: For devtools
// // import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// // Create a client
// const queryClient = new QueryClient({
//     defaultOptions: {
//         queries: {
//             staleTime: 1000 * 60 * 5, // 5 minutes
//             refetchOnWindowFocus: false, // Optional: Disable refetch on window focus
//             retry: 1, // Retry failed queries once
//         },
//     },
// });

// const rootElement = document.getElementById('root');
// if (rootElement) {
//   const root = createRoot(rootElement);
//   root.render(
//     <QueryClientProvider client={queryClient}>
//       <App />
//       {/* Optional: Add React Query Devtools for debugging */}
//       {/* <ReactQueryDevtools initialIsOpen={false} /> */}
//     </QueryClientProvider>
//   );
// }