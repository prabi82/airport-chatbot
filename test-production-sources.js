// Test script to verify source links in production
const PRODUCTION_URL = 'https://airport-chatbot-bv30kor1k-prabikrishna-gmailcoms-projects.vercel.app';

async function testProductionSources() {
    console.log('🚀 Testing Production Source Links');
    console.log('Production URL:', PRODUCTION_URL);
    
    try {
        // Create session first
        console.log('\n📝 Creating session...');
        const sessionResponse = await fetch(`${PRODUCTION_URL}/api/chat/session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                language: 'en'
            })
        });

        if (!sessionResponse.ok) {
            const errorText = await sessionResponse.text();
            console.log('Session response status:', sessionResponse.status);
            console.log('Session response body:', errorText);
            throw new Error(`Session creation failed: ${sessionResponse.status} - ${errorText}`);
        }

        const sessionData = await sessionResponse.json();
        console.log('✅ Session created:', sessionData.sessionId);

        // Test KFC query
        console.log('\n💬 Testing KFC query...');
        const kfcResponse = await fetch(`${PRODUCTION_URL}/api/chat/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: 'is there a KFC at the airport?',
                sessionId: sessionData.sessionId
            })
        });

        if (!kfcResponse.ok) {
            throw new Error(`KFC query failed: ${kfcResponse.status}`);
        }

        const kfcData = await kfcResponse.json();
        console.log('\n📊 KFC Query Response:');
        console.log('Success:', kfcData.success);
        console.log('Provider:', kfcData.provider);
        console.log('Sources:', kfcData.sources);
        console.log('Sources count:', kfcData.sources ? kfcData.sources.length : 0);
        
        if (kfcData.sources && kfcData.sources.length > 0) {
            console.log('🎉 SUCCESS: Sources found in production!');
            kfcData.sources.forEach((source, index) => {
                console.log(`  ${index + 1}. ${source}`);
            });
        } else {
            console.log('❌ ISSUE: No sources returned from production API');
        }

        // Test parking query
        console.log('\n💬 Testing parking query...');
        const parkingResponse = await fetch(`${PRODUCTION_URL}/api/chat/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: 'what are the parking rates?',
                sessionId: sessionData.sessionId
            })
        });

        const parkingData = await parkingResponse.json();
        console.log('\n📊 Parking Query Response:');
        console.log('Success:', parkingData.success);
        console.log('Provider:', parkingData.provider);
        console.log('Sources:', parkingData.sources);
        console.log('Sources count:', parkingData.sources ? parkingData.sources.length : 0);

        if (parkingData.sources && parkingData.sources.length > 0) {
            console.log('🎉 SUCCESS: Parking sources found!');
            parkingData.sources.forEach((source, index) => {
                console.log(`  ${index + 1}. ${source}`);
            });
        } else {
            console.log('❌ ISSUE: No parking sources returned');
        }

        console.log('\n📋 Summary:');
        console.log('- KFC sources:', kfcData.sources ? kfcData.sources.length : 0);
        console.log('- Parking sources:', parkingData.sources ? parkingData.sources.length : 0);
        
        if ((kfcData.sources && kfcData.sources.length > 0) || 
            (parkingData.sources && parkingData.sources.length > 0)) {
            console.log('\n✅ CONCLUSION: API is returning sources correctly!');
            console.log('The issue might be:');
            console.log('  1. Browser cache serving old widget files');
            console.log('  2. Widget JavaScript not processing sources correctly');
            console.log('  3. Console logs not showing in production');
        } else {
            console.log('\n❌ CONCLUSION: API is not returning sources');
            console.log('Possible causes:');
            console.log('  1. Knowledge base entries missing sourceUrl field');
            console.log('  2. AI service not collecting sources');
            console.log('  3. Database connection issues');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testProductionSources(); 