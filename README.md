# steagles-api

# For testing the API on your local machine

In the functions/app.js file, make sure to change **router** to **app** 

At the bottom of app.js the bottom 4 lines should appear as so for local testing (bottom 2 lines commented out, top 2 uncommented)

**const PORT = process.env.PORT || 3000**
**app.listen(PORT, () => console.log(🚀 Server listening on port ${PORT}))**
~~// module.exports = app;~~
~~// module.exports.handler = serverless(app);~~

To test the API calls, in app.js insert your auth token into the **get(user/teams)** function.

If all is done properly, in your IDE terminal execute node functions/app.js and you should get the message 🚀 Server listening on port 3000

Navigate to localhost:3000/user/teams in your browser and a working API will return data, if a 401 error is returned double check the steps listed above.

Before testing the front end, remove your auth token and replace the access_token you overwrote