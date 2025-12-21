// Test the formatting function with the actual response
const testContent = `**Sleeping Seats at Muscat International Airport**

✅ **Yes, sleeping seats are available!**

**📍 Location:**
Sleeping seats can be found at the end of the departure hall.

**💰 Cost:**
The seats are **free of charge** on a first come, first served basis.

**💡 Additional Information:**
• Available for all passengers
• No reservation required
• Comfortable seating for rest and relaxation
• Suitable for waiting between flights or overnight stays

**📞 For More Information:**
• Airport Support: +968 24351234
• Visit the Airport Information Desk for directions to the sleeping seats area`;

function formatMessageContent(content) {
  if (!content) return '';
  
  let result = String(content);
  
  // Step 1: Convert [text](url) to clickable links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(match, text, url) {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 500;">${text}</a>`;
  });
  
  // Step 2: Split into lines for processing
  const lines = result.split('\n');
  const processedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Empty line = spacing
    if (!trimmed) {
      processedLines.push('<div style="margin: 8px 0;"></div>');
      continue;
    }
    
    // Check if line is a section header (entire line is bold text like **📍 Location:**)
    const boldMatch = trimmed.match(/^\*\*([^*]+)\*\*$/);
    if (boldMatch) {
      // This is a section header
      const headerText = boldMatch[1];
      processedLines.push(`<div style="margin-top: 16px; margin-bottom: 8px; font-weight: 600; font-size: 1.05em; color: #1e40af;">${headerText}</div>`);
      continue;
    }
    
    // Check if line starts with bullet point
    if (trimmed.match(/^[•\-]\s+/)) {
      const content = trimmed.replace(/^[•\-]\s+/, '');
      // Convert any remaining bold text in the bullet point
      const formattedContent = content.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight: 600; color: #1e40af;">$1</strong>');
      processedLines.push(`<div style="margin: 4px 0; padding-left: 24px; position: relative; line-height: 1.6;">• ${formattedContent}</div>`);
      continue;
    }
    
    // Regular line - convert bold text and preserve
    const formattedLine = trimmed.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight: 600; color: #1e40af;">$1</strong>');
    processedLines.push(`<div style="margin: 4px 0; line-height: 1.6;">${formattedLine}</div>`);
  }
  
  // Join all processed lines
  result = processedLines.join('');
  
  return result;
}

const formatted = formatMessageContent(testContent);
console.log('=== FORMATTED OUTPUT ===');
console.log(formatted);
console.log('\n=== HTML PREVIEW ===');
console.log('<div style="padding: 10px; border: 1px solid #ccc;">' + formatted + '</div>');

