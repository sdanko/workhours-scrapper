# Workhours Scrapper

Key features:

- Installs and runs Google Chrome headless. Putting this into a second application keeps your application's image smaller, enabling quicker deployment.
- Auto starts when needed. Google Chrome is known to require considerable memory. Instead of scaling your app's memory requirements to handle peak usage when, you can separately scale your app and this appliance. The memory needed to run this app
  will only be allocated when you are generating PDFs. Stops after a configurable idle period.
- Reuses the Google Chrome instance across multiple requests. Starting Chrome can add a second or two to scrapping. By reusing an
  existing instance this can be avoided. When combined with disabling JavaScript, achieving sub-second response times can be achieved.
