const dotenv = require('dotenv');
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const { logger, logEnter, logExit } = require('./config/logger');
const { CustomError } = require('./error/CustomError');
const db = require("./data/database.js");
const sessionRepository = require("./data/sessionRepository");
const i18n = require('i18n');
const accepts = require('accepts');
const cron = require('node-cron');
const campaignService = require("./service/campaignService");

// Charge les variables d'environnement
if (process.env.NODE_ENV === 'prod') {
  dotenv.config({ path: './.env.prod' });
} else {
  dotenv.config();
}

// Setup des tâches automatiques
// Création de la campagne de l'année courante, chaque 1er du mois de Juillet à Novembre
cron.schedule('0 9 1 7-11 *', () => {
  campaignService.startCampaign();
});

// Getting the routers
const indexRouter = require('./routes/index');
const userRouter = require('./routes/user');
const selectionRouter = require('./routes/selection');
const cotaRouter = require('./routes/cota');
const langswitchRouter = require('./routes/langswitch');
const statsRouter = require('./routes/stats');
const supplierRouter = require('./routes/supplier');

var app = express();

//Définition de la liste des langues
const supportedLanguages = ['en', 'fr'];

// Configuration de i18n : Package pour le multilangue
i18n.configure({
  locales: supportedLanguages,
  directory: __dirname + '/locales',
  defaultLocale: 'en',
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

//Middlewares
app.use(i18n.init);
//app.use(logger('dev')); unused
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
// test
app.use((req, res, next) => {
  res.locals.baseUrl = "https://developer-jetlab.analytics.safran/studio/15056d7a-ef2a-4d09-b0dc-7b3f2e3cbb78/proxy/3000"
  console.log(`Current URL: ${req.url}`);
  next(); // Call next() to proceed to the next middleware or route handler
});

//Language middleware
app.use('/:lang', function (req, res, next) {
  // Step 1: Vérification du cookie de langue en premier
  var languageCookie = req.cookies.lang;
  if (req.params.lang && languageCookie) {
    if (req.params.lang !== languageCookie) {
      const newUrl = req.originalUrl.replace("/" + req.params.lang + "/", "/" + languageCookie + "/");
      logger.debug(newUrl)
      return res.redirect(res.locals.baseUrl+newUrl);
    }
  }
  //Step 2: Si cookie inexistant, Vérification du header Accept-Language
  else {
    const accept = accepts(req);
    const bestLang = accept.language(supportedLanguages) || 'en'; // anglais par défaut
    if (req.params.lang !== bestLang) {
      const newUrl = req.originalUrl.replace("/" + req.params.lang + "/", "/" + bestLang + "/");
      return res.redirect(res.locals.baseUrl+newUrl);
    }
  }
  const lang = req.params.lang;
  if (supportedLanguages.includes(lang)) {
    req.setLocale(lang);
    res.locals.lang = lang;
  } else {
    return res.status(404).send('Language not supported');
  }
  next();
});

//Auth middleware
/*app.use(async function (req, res, next) {
  try {
    const sessionid = req.cookies.session
    if (sessionid) {
      const session = await sessionRepository.getSessionData(sessionid)
      if (session) {
        logger.debug("Auth Middleware: Current session: " + JSON.stringify(session));
        res.locals.session = session
      }
    }
    else {
      logger.debug("Auth Middleware: No current session")
    }
    next();
  }
  catch (e) {
    logger.error("test: "+e.message);
  }
}
)*/
// Auth middleware
app.use(async function (req, res, next) {
  try {
    const sessionid = req.cookies.session;
    
    if (!sessionid) {
      logger.debug("Auth Middleware: No current session");
      return next();
    }
    
    const session = await sessionRepository.getSessionData(sessionid);
    
    if (!session) {
      logger.debug("Auth Middleware: Session not found");
      return next();
    }

    logger.debug("Auth Middleware: Current session: " + JSON.stringify(session));
    res.locals.session = session;

    next();
  } catch (e) {
    logger.error("Auth Middleware: " + e.message);
    next(e); // Pass the error to the next middleware
  }
});

app.use('/', indexRouter);
app.use('/:lang/user', userRouter);
app.use('/:lang/selection', selectionRouter);
app.use('/:lang/cota', cotaRouter);
app.use('/:lang/langswitch', langswitchRouter);
app.use('/:lang/stats', statsRouter);
app.use('/:lang/supplier', supplierRouter);


//error handler
app.use(function (err, req, res, next) {
  console.error(err);
  if (err instanceof CustomError) {
    //res.status(err.status).json({ error: err.message });
    res.send(req.__(err.message))
  } else {
    //res.status(500).json({ error: 'Internal Server Error' });
    res.send(req.__(err.message))
  }
});

module.exports = app;
