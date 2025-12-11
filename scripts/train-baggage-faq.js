const fs = require('fs').promises;
const path = require('path');

// Configuration
const BAGGAGE_FAQ_FILE = path.join(__dirname, '..', 'baggage_faq.md');
const API_BASE_URL = 'http://localhost:3000/api/admin/knowledge';

// Function to parse markdown and extract Q&A pairs
function parseBaggageFAQ(content) {
  const questions = [];
  
  // Split content by question markers (### Q followed by number)
  const questionBlocks = content.split(/### Q\d+:/);
  
  // Skip the first element (header content before first question)
  for (let i = 1; i < questionBlocks.length; i++) {
    const block = questionBlocks[i].trim();
    
    // Extract question (first line until first **A:**)
    const questionMatch = block.match(/^([^*]+?)(?=\*\*A:\*\*)/);
    if (!questionMatch) continue;
    
    const question = questionMatch[1].trim();
    
    // Extract answer (everything after **A:** until next major section or end)
    // This includes all content including bullet points, steps, etc.
    const answerMatch = block.match(/\*\*A:\*\*\s*([\s\S]*?)(?=(?:---\s*$|$))/);
    if (!answerMatch) continue;
    
    let answer = answerMatch[1].trim();
    
    // Clean up answer formatting
    answer = answer
      .replace(/\*\*([^*]+):\*\*/g, '**$1:**') // Fix bold formatting
      .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
      .replace(/^\*\*([^*]+):\*\*\s*/gm, '**$1:** ') // Ensure space after colons
      .replace(/\n\s*---\s*$/, '') // Remove any trailing separators
      .trim();
    
    // Determine subcategory based on question content
    let subcategory = 'General';
    const questionLower = question.toLowerCase();
    
    if (questionLower.includes('check-in') || questionLower.includes('check in')) {
      subcategory = 'Check-in Process';
    } else if (questionLower.includes('weight') || questionLower.includes('size') || questionLower.includes('restriction')) {
      subcategory = 'Weight & Size Limits';
    } else if (questionLower.includes('pack') || questionLower.includes('packing')) {
      subcategory = 'Packing Guidelines';
    } else if (questionLower.includes('carry-on') || questionLower.includes('prohibited') || questionLower.includes('valuable')) {
      subcategory = 'Carry-on & Prohibited Items';
    } else if (questionLower.includes('security') || questionLower.includes('screening')) {
      subcategory = 'Security & Processing';
    } else if (questionLower.includes('claim') || questionLower.includes('collect') || questionLower.includes('arrival')) {
      subcategory = 'Baggage Claim';
    } else if (questionLower.includes('lost') || questionLower.includes('delayed') || questionLower.includes('damaged')) {
      subcategory = 'Lost & Damaged Baggage';
    } else if (questionLower.includes('excess') || questionLower.includes('special') || questionLower.includes('connecting')) {
      subcategory = 'Special Services';
    } else if (questionLower.includes('contact') || questionLower.includes('phone') || questionLower.includes('email')) {
      subcategory = 'Contact Information';
    }
    
    // Generate keywords for better search
    const keywords = [
      'baggage', 'luggage', 'suitcase', 'bag', 'bags',
      ...question.toLowerCase().split(/\s+/).filter(word => word.length > 3),
      ...answer.toLowerCase().match(/\b\w{4,}\b/g) || []
    ];
    
    // Remove duplicates and common words
    const uniqueKeywords = [...new Set(keywords)].filter(word => 
      !['this', 'that', 'with', 'from', 'they', 'have', 'will', 'your', 'must', 'should'].includes(word)
    ).slice(0, 15); // Limit to 15 keywords
    
    questions.push({
      question: question,
      answer: answer,
      category: 'baggage',
      subcategory: subcategory,
      keywords: uniqueKeywords,
      priority: 1,
      sourceUrl: 'https://www.muscatairport.co.om/en/content/baggage',
      dataSource: 'manual'
    });
  }
  
  return questions;
}

// Function to add knowledge entries via API
async function addKnowledgeEntry(entry) {
  try {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(entry)
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorData}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error adding knowledge entry:', error.message);
    throw error;
  }
}

// Main training function
async function trainBaggageFAQ() {
  try {
    console.log('🎯 Starting Baggage FAQ Training...\n');
    
    // Read the baggage FAQ file
    console.log('📖 Reading baggage FAQ document...');
    const content = await fs.readFile(BAGGAGE_FAQ_FILE, 'utf8');
    console.log('✅ File read successfully');
    
    // Parse Q&A pairs
    console.log('🔍 Parsing Q&A pairs from document...');
    const questions = parseBaggageFAQ(content);
    console.log(`✅ Extracted ${questions.length} Q&A pairs`);
    
    if (questions.length === 0) {
      throw new Error('No questions found in the document');
    }
    
    // Display categories summary
    const categoryCount = {};
    questions.forEach(q => {
      categoryCount[q.subcategory] = (categoryCount[q.subcategory] || 0) + 1;
    });
    
    console.log('\n📊 Questions by subcategory:');
    Object.entries(categoryCount).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count} questions`);
    });
    
    // Add entries to knowledge base
    console.log('\n💾 Adding entries to knowledge base...');
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      try {
        console.log(`   [${i + 1}/${questions.length}] Adding: "${question.question.substring(0, 50)}..."`);
        
        await addKnowledgeEntry(question);
        successCount++;
        console.log(`   ✅ Added successfully`);
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        errorCount++;
        console.log(`   ❌ Failed: ${error.message}`);
      }
    }
    
    console.log('\n🎉 Training Complete!');
    console.log(`📈 Results:`);
    console.log(`   ✅ Successfully added: ${successCount} entries`);
    console.log(`   ❌ Failed: ${errorCount} entries`);
    console.log(`   📊 Success rate: ${Math.round((successCount / questions.length) * 100)}%`);
    
    if (successCount > 0) {
      console.log('\n🤖 The chatbot has been trained with baggage FAQ knowledge!');
      console.log('💡 Try asking questions like:');
      console.log('   - "How do I check in my baggage?"');
      console.log('   - "What items are prohibited in carry-on?"');
      console.log('   - "What should I do if my baggage is lost?"');
      console.log('   - "How much baggage can I bring?"');
    }
    
  } catch (error) {
    console.error('❌ Training failed:', error.message);
    process.exit(1);
  }
}

// Add fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

// Run the training
if (require.main === module) {
  trainBaggageFAQ()
    .then(() => {
      console.log('\n✨ Baggage FAQ training completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Training failed:', error.message);
      process.exit(1);
    });
}

module.exports = { trainBaggageFAQ, parseBaggageFAQ }; 