var express = require('express');
var router = express.Router();

// Redirection depuis la racine
router.get('/', function (req, res, next) {
  if (res.locals.session) {
    console.log(`${res.locals.baseUrl}/en/selection`)
    res.redirect(`${res.locals.baseUrl}/en/selection`);
  }
  else {
    res.redirect(`${res.locals.baseUrl}/en/user/login`);
  }
});
module.exports = router;