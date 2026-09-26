export const metadata = {
  title: 'LUXE Backend API',
  description: 'Backend API Service for LUXE E-commerce',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, backgroundColor: '#f9f9f9' }}>{children}</body>
    </html>
  );
}
