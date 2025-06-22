export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center text-white">
          <h1 className="text-5xl font-bold mb-6">
            ✈️ Oman Airports AI Chatbot
          </h1>
          <p className="text-xl mb-8 opacity-90">
            Experience the Future of Airport Assistance
          </p>
          
          <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-md rounded-2xl p-8 mb-12">
            <h2 className="text-2xl font-semibold mb-6">🚀 Live Demo Available</h2>
            <p className="text-lg mb-6 opacity-90">
              Our AI-powered chatbot is ready to help with flight information, airport services, 
              and general assistance. Try it now using the chat widget!
            </p>
            
            <div className="grid md:grid-cols-3 gap-6 text-left">
              <div className="bg-white/10 rounded-xl p-6">
                <h3 className="font-semibold mb-3">✈️ Flight Information</h3>
                <p className="text-sm opacity-80">Real-time flight status, gate information, and schedules</p>
              </div>
              <div className="bg-white/10 rounded-xl p-6">
                <h3 className="font-semibold mb-3">🏢 Airport Services</h3>
                <p className="text-sm opacity-80">Facilities, amenities, dining, and shopping information</p>
              </div>
              <div className="bg-white/10 rounded-xl p-6">
                <h3 className="font-semibold mb-3">🚗 Transportation</h3>
                <p className="text-sm opacity-80">Parking, taxi services, and transportation options</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/demo.html"
              className="inline-flex items-center px-8 py-3 bg-white text-blue-600 font-semibold rounded-full hover:bg-blue-50 transition-colors"
            >
              🎮 Try Interactive Demo
            </a>
            <a
              href="/test.html"
              className="inline-flex items-center px-8 py-3 bg-white/20 text-white font-semibold rounded-full hover:bg-white/30 transition-colors border border-white/30"
            >
              🧪 Test Widget
            </a>
          </div>

          <div className="mt-16 text-center">
            <p className="text-lg opacity-75">
              🤖 Powered by AI • 🔄 Real-time Data • 🌐 Multi-language Support
            </p>
          </div>
        </div>
      </div>

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
    </div>
  );
}
