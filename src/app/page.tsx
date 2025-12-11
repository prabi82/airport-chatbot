export default function Home() {
  return (
    <>
      {/* Chat Widget Integration */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.omanairportsChatConfig = {
              apiUrl: window.location.origin + '/api',
              theme: 'light',
              language: 'en',
              position: 'bottom-right'
            };
          `
        }}
      />
      <script src="/widget/chat-widget.js" async />
    </>
  );
}
