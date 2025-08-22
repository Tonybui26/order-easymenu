Rule of the Concept for Order Manager by EasyMenu
Overview
The "Order Manager by EasyMenu" is a frontend-only web application built with Next.js, designed as a lightweight tool for restaurant staff to manage daily order operations (receiving, accepting, and updating delivery status). It integrates with the main EasyMenu web app’s backend by making API requests to fetch and update data stored in a shared MongoDB database. The app is mobile-friendly, optimized for restaurant workflows, and will later be converted to a native mobile app. The API URL and specific endpoints will be specified later, but the app assumes a RESTful API with JWT-based authentication.
Purpose

Provide restaurant staff with a simple, focused interface to:
View pending and active orders for their restaurant.
Accept or reject orders.
Update order delivery status.


Reuse the existing EasyMenu backend (MongoDB) via API calls, ensuring data consistency with the main admin web app.
Prioritize performance, simplicity, and mobile responsiveness for daily restaurant operations.

Key Principles

Frontend-Only Architecture:

Built with Next.js (React) for a component-based, mobile-friendly UI.
No direct database access; all data operations (e.g., fetching orders, updating status) are performed via API requests to the main EasyMenu backend.
Use fetch or axios for HTTP requests, with a modular API client to handle authentication and requests.


API Integration:

Communicate with a RESTful API (URL to be specified later) for:
Authentication: Login to obtain a JWT for staff users.
Orders: Fetch pending/active orders, accept/reject orders, update delivery status.
User data: Retrieve logged-in user’s details (e.g., restaurant ID, role).


Assume API endpoints like:
POST /api/auth/login: Authenticate staff and return JWT.
GET /api/orders?restaurantId=<id>: Fetch orders for a restaurant.
POST /api/orders/<id>/accept: Accept an order.
PATCH /api/orders/<id>/status: Update order status (e.g., "delivered").


Include JWT in the Authorization header for authenticated requests.
Support real-time updates (e.g., via WebSocket or polling) for new orders.


User Management:

Staff users log in with email/password, verified by the backend’s users collection.
Store JWT in localStorage for web sessions.
Restrict access based on user role (staff) and restaurantId to show only relevant orders.
Example user context: { id, email, role, restaurantId }.


UI/UX Guidelines:

Use Tailwind CSS for a mobile-first, responsive design.
Key pages/components:
Login Page: Simple email/password form to authenticate staff.
Order List Page: Display pending and active orders with filters (e.g., by status).
Order Details Page: Show order details (items, customer info) with buttons to accept/reject or update status.


Prioritize simplicity: One-tap actions (e.g., accept order), clear visuals (e.g., status badges), and minimal navigation.
Include loading states and error handling for API requests.


State Management:

Use React Context or a lightweight library (e.g., Zustand) to manage:
User state (logged-in user’s details, JWT).
Order state (list of orders, current order details).


Sync state with API for real-time updates (e.g., new orders).


Performance and Optimization:

Use Next.js dynamic imports and code-splitting to minimize bundle size.
Cache API responses (e.g., menu data) in-memory to reduce requests.
Handle API errors gracefully with user-friendly messages (e.g., “Failed to load orders, try again”).


Security:

Store JWT securely in localStorage and include in API request headers.
Validate API responses to ensure only authorized data is displayed.
Use HTTPS for all API calls (assumed by default).


Extensibility:

Design components to be reusable (e.g., OrderCard, Button).
Structure the API client to allow easy updates when the API URL or endpoints are specified.
Prepare for future Capacitor integration by avoiding browser-specific APIs (e.g., avoid heavy reliance on window objects).





Development Guidelines

Initialize with npx create-next-app@latest order-manager --typescript.
Use TypeScript for type safety (e.g., type API responses, user data).
Install dependencies: axios (for API calls), tailwindcss, zustand (optional for state).
Follow REST API conventions for endpoint naming (to be finalized later).
Test UI on mobile devices (e.g., Chrome DevTools) to ensure responsiveness.
Document components and API calls for clarity.

Assumptions

The main EasyMenu backend provides a REST API with JWT authentication.
MongoDB stores users, orders, and menus, with fields like restaurantId for scoping.
API URL and specific endpoints will be provided later; use placeholders (e.g., BASE_API_URL) for now.
Real-time updates (e.g., new orders) will be supported via WebSocket or polling.
