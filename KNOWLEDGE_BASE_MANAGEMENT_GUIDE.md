# 📚 Knowledge Base Management Guide

## Overview
The admin dashboard now includes comprehensive knowledge base management features that allow you to create, edit, categorize, and manage all knowledge entries through a user-friendly interface.

## 🆕 New Features Added

### ✏️ **Edit Knowledge Entries**
- **Edit Button**: Each knowledge entry now has an "✏️ Edit" button
- **Modal Form**: Click edit to open a comprehensive editing modal
- **Full Field Editing**: Edit questions, answers, categories, subcategories, priority, and source URLs
- **Real-time Validation**: Form validates required fields before saving
- **Auto-save**: Changes are automatically saved to the database

### ➕ **Create New Entries**
- **New Entry Button**: Blue "➕ New Entry" button in the knowledge base section
- **Same Modal Interface**: Uses the same modal form as editing
- **Complete Entry Creation**: Create entries manually without web scraping
- **Category Management**: Choose from predefined categories or add custom ones

### 🏷️ **Enhanced Categorization**
- **Predefined Categories**: 
  - Flights
  - Transportation  
  - Parking
  - Services
  - Amenities
  - Security
  - Shopping
  - Dining
  - Accessibility
  - General
- **Custom Subcategories**: Add specific subcategories for better organization
- **Priority Levels**: Set priority from 1 (Low) to 5 (Critical)

## 🎯 How to Use

### **Editing Existing Entries**

1. **Navigate to Knowledge Base Tab**
   - Open admin dashboard at `http://localhost:3000/admin/dashboard`
   - Click on "Knowledge Base" tab

2. **Find and Edit Entry**
   - Use the search box to find specific entries
   - Click the "✏️ Edit" button on any knowledge entry
   - The edit modal will open with current values populated

3. **Make Changes**
   - **Question**: Edit the question text (required)
   - **Answer**: Modify the answer content (required) 
   - **Category**: Change the main category (required)
   - **Subcategory**: Add/edit subcategory (optional)
   - **Priority**: Set priority level 1-5
   - **Source URL**: Update or add source URL (optional)
   - **Data Source**: Select origin of the data (Manual, Scraping, Import)

4. **Save Changes**
   - Click "💾 Save Changes" to apply edits
   - Success message will appear
   - Knowledge base automatically refreshes

### **Creating New Entries**

1. **Start Creation**
   - Click "➕ New Entry" button in knowledge base section
   - Empty form modal will appear

2. **Fill Required Fields**
   - **Question**: Enter the question (required)
   - **Answer**: Provide comprehensive answer (required)
   - **Category**: Select appropriate category (required)

3. **Add Optional Details**
   - **Subcategory**: Specify subcategory for better organization
   - **Priority**: Set importance level (defaults to 1)
   - **Source URL**: Add reference URL if available
   - **Data Source**: Choose the origin of this data (defaults to Manual)

4. **Create Entry**
   - Click "➕ Create Entry" to save
   - Success confirmation will appear
   - New entry will appear in the knowledge base

### **Search and Filter**

- **Search Box**: Type keywords to filter entries by question, answer, or category
- **Real-time Filtering**: Results update as you type
- **Category Statistics**: View entry counts by category
- **Total Entries**: See total number of active entries
- **Pagination**: Browse through entries with 15 items per page
- **Smart Pagination**: Automatic page reset when searching
- **Page Navigation**: Previous/Next buttons and direct page number selection

### **Data Source Tags**

Each knowledge base entry now displays a colored tag indicating its origin:

- **✏️ Manual** (Purple): Entries created manually by administrators
- **🌐 Scraped** (Orange): Entries auto-generated from website scraping
- **📥 Imported** (Indigo): Entries imported from training data or external sources

This helps administrators:
- **Track Content Origin**: Know where each piece of information came from
- **Quality Control**: Identify auto-generated content that may need review
- **Content Management**: Prioritize manual content over scraped content
- **Audit Trail**: Maintain transparency about data sources

## 🔧 Technical Features

### **Form Validation**
- **Required Fields**: Question, Answer, and Category must be filled
- **Button State**: Save/Create button disabled until required fields are complete
- **Real-time Feedback**: Form validates on every input change

### **Modal Interface**
- **Responsive Design**: Works on desktop and mobile devices
- **Overlay Protection**: Click outside or press X to cancel
- **Escape Key**: Press ESC to close modal (browser default)
- **Focus Management**: Proper tab navigation through form fields

### **API Integration**
- **PUT Endpoint**: Updates existing entries via `/api/admin/knowledge` 
- **POST Endpoint**: Creates new entries via same endpoint
- **Error Handling**: Comprehensive error messages for failed operations
- **Success Feedback**: Clear confirmation messages for successful operations

### **Pagination System**
- **Entries Per Page**: Fixed limit of 15 entries per page for optimal performance
- **Smart Filtering**: Search results are automatically paginated
- **Page Controls**: Previous/Next buttons with disabled states when appropriate
- **Page Numbers**: Direct navigation to specific pages (shows up to 5 page numbers)
- **Entry Count Display**: Shows "Showing X to Y of Z entries" for clarity
- **Auto-Reset**: Automatically returns to page 1 when search term changes

## 📋 Data Structure

### **Knowledge Entry Fields**
```json
{
  "id": "unique-identifier",
  "question": "User question text",
  "answer": "Comprehensive answer",
  "category": "main-category",
  "subcategory": "optional-subcategory", 
  "priority": 1-5,
  "sourceUrl": "https://source-url.com",
  "dataSource": "manual|scraping|import",
  "keywords": ["auto-generated", "keywords"],
  "isActive": true,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### **Available Categories**
- **flights**: Flight-related information
- **transportation**: Ground transportation options
- **parking**: Parking facilities and rates
- **services**: Airport services (lounges, assistance, etc.)
- **amenities**: Facilities and conveniences
- **security**: Security procedures and requirements
- **shopping**: Retail and shopping information
- **dining**: Restaurants and food options
- **accessibility**: Accessibility features and services
- **general**: General airport information

## 🎨 UI/UX Features

### **Visual Design**
- **Clean Modal**: Modern, centered modal with proper spacing
- **Color Coding**: Blue for create/edit actions, red for delete
- **Icons**: Emojis for visual clarity (✏️ Edit, ➕ Create, 🗑️ Delete)
- **Button States**: Disabled state for incomplete forms
- **Loading States**: Visual feedback during API operations

### **Responsive Layout**
- **Desktop**: Full-width modal with side-by-side fields
- **Tablet**: Stacked layout with proper spacing
- **Mobile**: Single-column layout optimized for touch

### **Accessibility**
- **Screen Reader Support**: Proper ARIA labels and roles
- **Keyboard Navigation**: Full keyboard accessibility
- **Focus Management**: Logical tab order through form elements
- **Color Contrast**: High contrast for readability

## 🔒 Security Features

### **Authentication Required**
- All knowledge base management requires admin authentication
- Session validation on every API request
- Automatic logout on session expiration

### **Data Validation**
- Server-side validation for all fields
- XSS protection for text inputs
- SQL injection prevention via Prisma ORM
- Input sanitization for URLs and text fields

## 📊 Performance

### **Optimized Operations**
- **Lazy Loading**: Modal only renders when needed
- **Efficient Updates**: Only modified fields are updated
- **Batch Refresh**: Knowledge base refreshes after operations
- **Memory Management**: Form state cleaned up on modal close

### **Database Efficiency**
- **Indexed Queries**: Fast search and filtering
- **Transactional Updates**: Atomic database operations
- **Connection Pooling**: Efficient database connections
- **Query Optimization**: Minimal database calls

## 🚀 Future Enhancements

### **Planned Features**
- **Bulk Edit**: Select and edit multiple entries
- **Import/Export**: CSV import/export functionality  
- **Version History**: Track changes over time
- **Advanced Search**: Filters by category, priority, date
- **Duplicate Detection**: Prevent duplicate entries
- **AI Suggestions**: AI-powered answer improvements

### **Integration Options**
- **Content Management**: Integration with external CMS
- **Analytics**: Track entry usage and effectiveness
- **Workflow**: Approval process for entry changes
- **Notifications**: Email alerts for important changes

## 💡 Best Practices

### **Content Creation**
1. **Clear Questions**: Write questions as users would ask them
2. **Comprehensive Answers**: Provide complete, helpful answers
3. **Proper Categorization**: Use appropriate categories and subcategories
4. **Priority Setting**: Set priority based on frequency and importance
5. **Source Documentation**: Always include source URLs when available

### **Maintenance**
1. **Regular Review**: Periodically review and update entries
2. **Content Accuracy**: Ensure information remains current
3. **Performance Monitoring**: Track which entries are most accessed
4. **User Feedback**: Incorporate user feedback into content updates
5. **Consistency**: Maintain consistent tone and formatting

## 📞 Support

For technical issues or questions about knowledge base management:
- Check error messages in the admin dashboard
- Review browser console for detailed error information
- Verify database connectivity in System tab
- Contact system administrator for persistent issues

---

**Last Updated**: January 2025  
**Version**: 1.0  
**Compatibility**: Next.js 14+, React 18+, Prisma 6+ 