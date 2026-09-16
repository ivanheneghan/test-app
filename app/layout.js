export const metadata = { title: "Hello World" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
