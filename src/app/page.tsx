export default function ApiHome() {
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', padding: '3rem', maxWidth: '640px', margin: '0 auto', lineHeight: '1.6' }}>
      <h1 style={{ fontSize: '1.8rem', color: '#111', marginBottom: '0.5rem' }}>LUXE E-Commerce API Service</h1>
      <p style={{ color: '#555' }}>Backend service is operational on port <code>3001</code>.</p>
      
      <h2 style={{ fontSize: '1.2rem', marginTop: '2rem', marginBottom: '0.75rem', color: '#222' }}>Available API Endpoints:</h2>
      <ul style={{ paddingLeft: '1.25rem', color: '#333' }}>
        <li><code>GET /api/products</code> - List products</li>
        <li><code>GET /api/products/[id]</code> - Product detail</li>
        <li><code>POST /api/auth/login</code> - User login</li>
        <li><code>POST /api/auth/register</code> - User registration</li>
        <li><code>GET /api/auth/me</code> - Current user profile</li>
        <li><code>GET, POST /api/cart</code> - Cart management</li>
        <li><code>GET, POST /api/orders</code> - Order placement & history</li>
        <li><code>POST /api/payment</code> - Mock payment gateway</li>
      </ul>
    </div>
  );
}
