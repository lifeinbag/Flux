✅ Project Coding Guidelines & Context Optimization
🔧 Coding Preferences (Always Follow)
Keep code concise and simple – avoid unnecessary complexity

No long explanations – brief responses only



Focus on functionality over verbose comments

Always search project knowledge first before editing any file

NEVER make random or assumed changes – edit only existing files from project

Use project_knowledge_search to find the current version of a file before modifying

🧠 Code Output Format (NEW)


Clearly specify the exact location for placing each code block, like:

“Place below router.post("/login"... in server/routes/auth.js”

“Replace entire function handleSubmit() in Dashboard.jsx”

🛡️ Why This Format?
Prevents hitting ChatGPT response token/usage limits

Keeps change tracking clean and minimal

Helps user quickly identify & verify updates

🧼 Permanent Code Cleanliness & Structure Instructions (For All Files)
🔸 Avoid Redundant Comments
Do not repeat identical route descriptions or boilerplate headers.

Use one clean JSDoc-style comment per group, e.g., all route handlers or helper methods.

🔸 Group Helpers and Utilities Compactly
Combine all standalone helper functions into one continuous section.

Avoid banner-style comments and unnecessary blank lines between helpers.

🔸 Standardize Catch/Error Blocks
Always use a consistent format:

js
Copy
Edit
logger.error("[context]", error.message);
return res.status(500).json({ error: "Something went wrong" });
Keep error handling clean and avoid extra spacing or custom log formats.

🔸 Remove Dead/Test/Commented Code
Eliminate: console.log(), debugger statements ,Commented-out experiments,Dev-only test blocks,Unless a feature is actively in use, strip it out.