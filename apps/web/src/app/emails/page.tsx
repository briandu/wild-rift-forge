export const metadata = {
  title: 'Email previews',
};

const PREVIEWS = [
  { href: '/email-previews/welcome.html', label: 'Welcome / verify' },
  { href: '/email-previews/password-reset.html', label: 'Password reset' },
  { href: '/email-previews/weekly-digest.html', label: 'Weekly digest' },
] as const;

export default function EmailPreviewsPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        margin: 0,
        padding: '32px',
        background: '#0B0A12',
        color: '#DEDCEE',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 22, letterSpacing: '-0.4px' }}>Email previews</h1>
      <p style={{ color: '#8B87A8', lineHeight: 1.5, maxWidth: '42rem' }}>
        Static mockups from the email handoff. Auth send versions live in{' '}
        <code>supabase/templates/</code>.
      </p>
      <ul style={{ padding: 0, listStyle: 'none', display: 'grid', gap: 12, maxWidth: '28rem' }}>
        {PREVIEWS.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              style={{
                display: 'block',
                padding: '14px 16px',
                border: '1px solid #242235',
                borderRadius: 12,
                background: '#141220',
                color: '#7FDCFF',
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
