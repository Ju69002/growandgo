# **App Name**: BusinessPilot

## Core Features:

- Company Management: Manage company profiles, including name, subscription status, and module configurations.
- User Management: Manage user accounts with roles (super_admin, admin, employee) and company affiliations, using Firebase Authentication.
- Category Management: Define and manage categories (tiles) with labels, badge counts, visibility settings, and AI instructions, restricted to Super Admin for editing ai_instructions.
- Document Management & AI Analysis: Upload, store, and analyze documents using Vertex AI Gemini, extract data based on category-specific AI instructions, and update document status.
- Real-time Badge Updates: Automatically update badge counts on categories based on document status changes.
- Genkit Flows for AI Assistance: Provide AI-powered assistance with different access levels and system prompts based on user role, including EmployeeHelper, BossOperational, BossArchitect, and SuperAdminBuilder.
- Admin Mode: Allows the admin to switch into an architect role which allows modifications of categories (tiles). AI refuses new smart categories or modification of the ai_instructions and redirects the request to a super admin.

## Style Guidelines:

- Primary color: Deep Indigo (#3F51B5) to convey trust and professionalism.
- Background color: Very light gray (#F5F5F5) to maintain a clean, corporate look.
- Accent color: Teal (#009688) to draw attention to interactive elements.
- Body and headline font: 'Inter', a sans-serif font, to provide a modern, machined, objective, neutral look.
- Use a set of minimalist icons, with consistent styling to represent the categories.
- Maintain a clean, organized layout, making sure to leave appropriate whitespace so that different sections remain distinct.
- Incorporate subtle animations during data loading and status updates to enhance user experience.