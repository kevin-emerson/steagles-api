# steagles-api

## For testing the API on your local machine

In the functions/app.js file, make sure to change router to app 

**do not change these lines!**

// Parse Cookie
router.use(cookieParser())

// Enable netlify deploys
router.use("/.netlify/functions/app", router);

At the bottom of app.js the bottom 4 lines should appear as so for local testing (bottom 2 lines commented out, top 2 uncommented)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`))
// module.exports = app;
// module.exports.handler = serverless(app);

If all is done properly, in your IDE terminal execute **node functions/app.js**
and you should get the message **🚀 Server listening on port 3000**

If it does not execute, double check the proper lines of code listed above are commented/uncommented properly. 

