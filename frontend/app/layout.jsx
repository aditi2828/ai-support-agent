import "./globals.css";

export const metadata = {
  title: "Support Knowledge Agent",
  description: "RAG-powered internal support assistant",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
