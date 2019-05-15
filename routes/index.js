var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var db = require('../db');
var fs = require('fs');

/**
      /v1/gps/survey/:key.json

      /v1/dir/politician/:key.json

      /v1/gps/answer/segment/2019_be_all_be_:key.json

      /v1/vote/election/2019_be/candidates/be_:key.json

      /v1/vote/election/2019_be/district/be_:key.json

      /v1/vote/electoral-districts.json

 */



/**
 * Get 2019 elections questions
 *
 * @todo => output the elections questions like in http://demo-api.wecitizens.be/v1/gps/survey/2018_be_municipal_brussels_urban.json format
 */
router.get('/v1/gps/survey/:key.json', function (req, res) {

  const key = req.params['key'];
  const regional_id = req.query.reg;

  db.query("SELECT id, elected_authority, year, Date from election WHERE Date = ?", key, function (err, elections) {

    if (err) throw err;

    let survey = {
      'key': "election_2019",
      'name': "election_2019",
      "i18n": {
        "en": {},
        "nl": {},
        "fr": {}
      }
    }

    let electionIds = elections.filter(function (election) {
      if (election.elected_authority === "EUROP" || election.elected_authority === "BEFCH" || election.elected_authority == regional_id) {
        return election.id;
      } else {
        return false;
      }
    });

    survey.ids = electionIds;

    // adding caxent libertas specific questionnaire - in the future a questionnaire table should replace this hack:
    let questionnaires = [];
    function extendElectionQuestionnaire(aElection, index) {
      questionnaires.push(aElection.id);
      if (aElection.id==21) questionnaires.push( 26,30);
      else if (aElection.id==22) questionnaires.push( 27,31);
      if (aElection.id==23) questionnaires.push( 28,32);
      if (aElection.id==24) questionnaires.push( 33);
      if (aElection.id==25) questionnaires.push( 29,24);
    }
    electionIds.forEach(extendElectionQuestionnaire);
    survey.questionnaire = questionnaires;

    let questionsQuery = "SELECT DISTINCT opinions.* FROM questions_election, opinions where id_election in (" + questionnaires.join(',') +
      ") AND questions_election.opinion_id = opinions.id order by ordre";

    let questionSummary = [], questions = [];
    survey.question_order = [];


    db.query( questionsQuery, null, function (err, electionQuestions) {
        if (err) throw err;

        let question_fr={};
        let question_nl={};       let question_en={};

        console.log(electionQuestions);
        for (let i = 0; i < electionQuestions.length; i++) {
          let aQuestion = electionQuestions[i];
          let questionId = 'question_' + aQuestion.id;
          if (aQuestion.opinion_langue == 'nl') {
            survey.question_order.push(questionId);
            questionSummary.push({
              "key": questionId,
              "text": 'question.' + aQuestion.id + "_text",
              "notice": 'question.' + aQuestion.id + "_notice",
              "answer_format": "agr_5_scale_tol_3_scale_abs"
            })
            question_nl[aQuestion.id + "_text"] = aQuestion.opinion_question;
            question_nl[aQuestion.id + "_notice"]=aQuestion.opinion_explanation;

          }
          if (aQuestion.opinion_langue == 'fr') {
            question_fr[aQuestion.id + "_text"] = aQuestion.opinion_question;
            question_fr[aQuestion.id + "_notice"]= aQuestion.opinion_explanation;
          }
          if (aQuestion.opinion_langue == 'en') {
            question_en[aQuestion.id + "_text"] = aQuestion.opinion_question;
            question_en[aQuestion.id + "_notice"]= aQuestion.opinion_explanation;
          }
        }
        survey.questions = questionSummary;

        survey.i18n.fr.question = question_fr;
        survey.i18n.fr.answer_formats = {
          "item": {
            "yes": "Oui", "no": "Non", "strongly_agree": "Tout à fait d'accord", "agree": "Plutôt d'accord",
            "no_opinion": "Je ne me prononce pas", "disagree": "Plutôt pas d'accord","strongly_disagree": "Pas du tout d'accord"
          },
          "tolerance": {
            "item": {"very_important": "Très important", "important": "Important", "not_important": "Pas important" }
          }
        };

      survey.i18n.nl.question = question_nl;
      survey.i18n.nl.answer_formats =  {
        "item": {
          "yes": "Ja","no": "Nee","strongly_agree": "Helemaal akkoord",
          "agree": "Eerder ja","no_opinion": "Ik spreek mij niet uit","disagree": "Eerder nee",
          "strongly_disagree": "Helemaal niet akkoord"
        },
        "tolerance": {
          "item": {"very_important": "Zeer belangrijk","important": "Belangrijk","not_important": "Niet belangrijk"}
        }
      };

      survey.i18n.en.question = question_en;
      survey.i18n.en.answer_formats = {
        "item": {
          "yes": "Yes","no": "No","strongly_agree": "Fully agree","agree": "Rather yes",
          "no_opinion": "No opinion","disagree": "Rather no","strongly_disagree": "Strongly disagree"
        },
        "tolerance": {
          "item": {"very_important": "Very important","important": "Important","not_important": "Not important"}
        }
      };

      survey.answer_formats = JSON.parse(fs.readFileSync('public/v1/ref/answer_formats.json', 'utf8'));

      res.json(survey);

    })
  });
});



/**
 * Get polititican data
 *
 *
 * @tag municipal, regional
 */
router.get('/v1/dir/politician/:key.json', function (req, res) {

  var key = req.params['key'];

  key = key.replace('politician_be_', '');
  key = key.replace('be_politician_', '');

  db.query("SELECT * from politician WHERE id = ?", key, function (err, rows) {
    if (err) throw err;

    let item = rows[0];

    // Generate thumb
    item.thumb = "http://directory.wecitizens.be/assets/media/politician-thumb/" + item.id + ".jpg";

    res.json(item);
  });
});



/** ***********************************
 * Get election segment
 *   key:    EN   |   EN_electoral_list  | EN_candidate | EN_substitute | VX_candidate
 * @tag municipal
 */
router.get('/v1/gps/answer/segment/2019_be:key.json', function (req, res) {

  let key = req.params['key'];
  let electionTp = '';
  let politicianTp = '';
  let candidateStatus = 'candidate';

  console.log(key);;
  if (  key.includes('_reg')) {
    electionTp = 'reg';
    key = key.replace('_reg', '');
  }
  console.log(key);;
  if (  key.includes('_eur')) {
    electionTp = 'eur';
    key = key.replace('_eur', '');
  }
  console.log(key);;
  if (  key.includes('_fed')) {
    electionTp = 'fed';
    key = key.replace('_fed', '');
  }
  console.log(key);;
  if (  key.includes('_electoral_list')  || key.includes('_party')  ) {
    politicianTp = 'party';
    key = key.replace('_electoral_list', '');
    key = key.replace('_party', '');
  }
  console.log(key);;
  if (key.includes('_substitute')) {
    candidateStatus = 'substitute'
    key = key.replace('_substitute', '');
  }
  console.log(key);
  key = key.replace('_candidate', '');

  key = key.replace('_', '');
  const district = key;

  console.log('electionTp:', electionTp);
  console.log('district:', district );
  console.log('politicianTp:', politicianTp);
  console.log('candidateStatus:', candidateStatus);
  console.log(key);

  if ( politicianTp == 'party') {


    let electoralListQuery = `
SELECT DISTINCT
    a.id,
    CONCAT('2019_be_regional_be_', '` + district + `') AS segment_key,
    'electoral_list' AS segment_type,
    CONCAT('be_', '` + district + `' , '_', lower(replace(replace(party.abbr,'! &',''),' ','_'))) AS user_key,
    CONCAT('question_', a.opinion_id) AS question_key,
    CASE
        WHEN a.opinion_answer = '1' THEN 'strongly_agree'
        WHEN a.opinion_answer = '2' THEN 'agree'
        WHEN a.opinion_answer = '3' THEN 'no_opinion'
        WHEN a.opinion_answer = '4' THEN 'disagree'
        WHEN a.opinion_answer = '5' THEN 'strongly_disagree'
        ELSE 'no_opinion'
    END AS value,
    party.abbr as user_name, # added to ease compatibility but should not be part of segments
    a.opinion_received
FROM
    opinions_answers a
        JOIN
    politician p ON p.id = a.id_politician
        JOIN
    politician_election e ON e.id_politician = a.id_politician
        LEFT JOIN
    party party ON party.id = e.roll
        JOIN
    election ON election.id = e.id_election  
WHERE
    e.district LIKE '%` + district + `%'
    AND e.id_election IN ('21', '22', '23', '24', '25')  
    AND a.id_politician != 5439
    AND a.opinion_answer in ('1','2','3','4','5')
    AND party.abbr <> 'Other party'    
    AND p.personal_gender in ('i')
ORDER BY opinion_received DESC
  `;
    console.log(electoralListQuery);

    db.query(electoralListQuery, null, function (err, rows) {
      if (err) throw err;
      res.json({data: rows});
    });

  } else {

    let candidateQuery = `
SELECT DISTINCT
    a.id,
    CONCAT('2019_be_regional_be_', '` + district + `') AS segment_key,
    '` + candidateStatus + `' AS segment_type,
    CONCAT('be_politician_',a.id_politician) AS user_key,
    CONCAT('question_', a.opinion_id) AS question_key,
    (CASE
    WHEN a.opinion_answer = '1' THEN 'strongly_agree'
    WHEN a.opinion_answer = '2' THEN 'agree'
    WHEN a.opinion_answer = '3' THEN 'no_opinion'
    WHEN a.opinion_answer = '4' THEN 'disagree'
    WHEN a.opinion_answer = '5' THEN 'strongly_disagree'
    ELSE 'wrong'
    END) AS value
FROM
    opinions_answers a
        INNER JOIN
    politician p ON p.id = a.id_politician
        INNER JOIN
    politician_election e ON e.id_politician = a.id_politician
        INNER JOIN
    election ON election.id = e.id_election  
WHERE
    e.district LIKE '%` + district + `%'
    AND a.id_politician != 5439 
    AND e.id_election IN ('21', '22', '23', '24', '25')
    AND a.opinion_answer in ('1','2','3','4','5')
    AND p.personal_gender in ('m','f') `;

    candidateQuery += ` AND e.status = '` + candidateStatus + `' ORDER BY opinion_received DESC `;

    // Note 5439: id Jean-Paul Pinon
    console.log(candidateQuery);

    db.query(candidateQuery, district, function (err, rows) {
      if (err) throw err;

      res.json({data: rows});
    });
  }
});



/**      **********************************************
 * Get politician (OR party) participating in given election with :key in (EUROP|BERVL|BERBR|BERWA|BEFCH)
 *   optional query args:  '?status=candidate' or '?status=substitute'  or '?status=party'
 *        without 'status' query args:  default to politician (NO party), any status.
 *
 *   optional query args:  '?district=   '
 *
 *  typical query like:
 *    SELECT politician.id, politician.name, politician.surname, politician.personal_gender, politician.id_party,
      politician_election.roll, politician_election.place,
      party.abbr
      FROM politician_election, politician, party
      WHERE status = 'candidate'
      AND politician.personal_gender !='i'
      AND id_election = 25
      AND politician.id = politician_election.id_politician
      AND party.id = politician_election.roll
 */
router.get('/v1/vote/election/2019_be/candidates/be_:key.json', function (req, res) {

  let key = req.params['key'];
  const candidateStatus = req.query.status;   // ?status=candidate|substitute
  const candidateDistrict = req.query.district;   // ?district= FL |  FH | ED | EF  | EN | ...


  // ok, let's do it quickly...
  let elections = {EUROP:21, BEFCH:22, BERVL:23, BERWA:24, BERBR:25};
  let electionId= elections[key.toUpperCase()];

  let politiciansQuery = 'SELECT politician.id, politician.name, politician.surname, politician.personal_gender, ' +
      ' politician_election.place, politician_election.district, politician_election.status, party.abbr ' +
     ' FROM politician_election, politician, party ' +
      ' WHERE party.id = politician_election.roll ' +
     ' AND politician.id = politician_election.id_politician ' +
     ' AND id_election ='+ electionId ;

  if (candidateDistrict) {
    politiciansQuery += ' AND politician_election.district ="'+ candidateDistrict+'"' ;
  }

  if (candidateStatus=='party') {
    politiciansQuery += ' AND politician.personal_gender ="i" ';
  } else if (candidateStatus) {
    politiciansQuery += ' AND politician.personal_gender !="i" ';
    politiciansQuery += ' AND status ="'+ candidateStatus+'"' ;
  }

  console.log(politiciansQuery);
  let politiciansResponse = {}, candidates =[];

  db.query( politiciansQuery, null, function (err, politiciansQueryRes) {
    if (err) throw err;

    for (let idx = 0; idx < politiciansQueryRes.length; idx++) {
      let aCandidate = politiciansQueryRes[idx];
      candidates.push(aCandidate);
    }
    politiciansResponse.candidates = candidates;

    res.json(politiciansResponse);

  })
});



/**   **********************************************
 * Get district segment
 */
router.get('/v1/vote/election/2019_be/district/be_:key.json', function (req, res) {

  let key = req.params['key'];
  const district = key;
  console.log('Get district segment for ',  key);


  let queryStr = `SELECT MAX(segment_key)     as segment_key,
                   MAX(segment_type)    as segment_type,
                   MAX(list_key)        as list_key,
                   MAX(politician_key)  as politician_key,
                   id_politician        AS politician_id,
                   MAX(full_name)       as full_name,
                   MAX(img)             as img,
                   MAX(party)           as party,
                   MAX(position)        as position,
                   MAX(status)          as status,
                   MAX(has_answered)    as has_answered,
                   MAX(id_election)     as id_election,
                   MAX(completeness)    as completeness,
                   MAX(total_questions) as total_questions,
                   MAX(total_received)  as total_received
            FROM (SELECT segment_key,
                         segment_type,
                         list_key,
                         politician_key,
                         id_politician,
                         full_name,
                         img,
                         party,
                         position,
                         status,
                         has_answered,
                         id_election,
                         completeness,
                         total_questions,
                         COUNT(*) AS total_received
                  FROM (SELECT DISTINCT NULL         AS segment_key,
                                        NULL         AS segment_type,
                                        NULL         AS list_key,
                                        NULL         AS politician_key,
                                        a.id_politician,
                                        NULL         AS full_name,
                                        NULL         AS img,
                                        NULL         AS party,
                                        NULL         AS position,
                                        NULL         AS status,
                                        0            AS has_answered,
                                        0            AS id_election,
                                        0            AS completeness,
                                        0            AS total_questions,
                                        a.opinion_id AS question_key
                        FROM opinions_answers a
                                 INNER JOIN politician p ON p.id = a.id_politician
                                 INNER JOIN politician_election e ON e.id_politician = a.id_politician
                                 INNER JOIN election ON election.id = e.id_election
                                 INNER JOIN localite_menu ON localite_menu.id_gps = election.id_gps
                        WHERE a.id_politician != 5439
                          AND e.id_election IN ('21', '22', '23', '24', '25')
                          AND e.district LIKE '%` + district + `%'
                          AND a.opinion_answer IN ('1', '2', '3', '4', '5')
                          AND p.personal_gender IN ('m', 'f', 'i')
                        ORDER BY opinion_received DESC) segment
                  GROUP BY segment_key, segment_type, list_key, politician_key, id_politician, full_name, img, party,
                           position, status, has_answered, id_election, completeness, total_questions
                  UNION
                  SELECT CONCAT('2019_be_regional_be_','%\` + district + \`%' )   AS segment_key,
                         (CASE
                              WHEN p.personal_gender = 'i' THEN 'electoral_list'
                              WHEN e.status= 'candidate' THEN 'candidate'
                              WHEN e.status = 'substitute' THEN 'substitute'
                              ELSE 'wrong'
                             END)                                                         AS segment_type,
                         CONCAT('be_', '` + district + `', '_',
                                LOWER(REPLACE(REPLACE(party.abbr, '! &', ''), ' ', '_'))) AS list_key,
                         CONCAT('be_politician_', p.id)                                   AS politician_key,
                         p.id                                                             AS politician_id,
                         CONCAT(p.name, ' ', p.surname)                                   AS full_name,
                         pic.full_path                                                    AS img,
                         party.abbr                                                       AS party,
                         e.place                                                          AS position,
                         e.status                                                         AS status,
                         e.questionnaire                                                  AS has_answered,
                         e.id_election                                                    AS id_election,
                         p.completeness_of_profile                                        AS completeness,
                         45                                                               AS total_questions,
                         0                                                                AS total_received
                  FROM politician_election e
                           JOIN politician_job j ON j.id_politician = e.id_politician
                           JOIN politician p ON p.id = e.id_politician
                           LEFT JOIN party party ON party.id = e.roll
                           LEFT JOIN politician_photos pic ON pic.id_politician = e.id_politician
                           JOIN election ON election.id = e.id_election
                  WHERE e.district LIKE '%` + district + `%'
                    AND e.id_election IN ('21', '22', '23', '24', '25')
                  GROUP BY e.id_politician) all_together
            GROUP BY id_politician
            ORDER BY id_politician DESC`;

    console.log(queryStr);
    db.query(queryStr, [], (err, rows) => {

    /**
     * @TODO => activate e.questionnaire = 1 when candidates answers to everything
     */

    if (err) {
      throw  err;
    }

    let data = {
      "key": "2019_be_eur_fed_reg_" + key,
      "type": "be_eur_reg_fed",
      "type_name": "be_eur_fed_reg",
      "date": "2019-05-26T00:00:00.000Z",
      "main_election_key": "2019_be_eur_fed_reg",
      "district_key": "be_" + key,
      "electoral_lists": [],
      "candidates": [],
      "i18n": {
        "en": {},
        "nl": {},
        "fr": {}
      }
    };

    let lists = {};
    let candidates = {};
    let substitutes = {};
    let names = {};

    rows.map((item) => {

      let imgUrl = (url) => {
        return url ? url.replace('/home/wecitizens/domains/wecitizens.be/public_html/directory/', 'http://directory.wecitizens.be/') : null
      }

      if (typeof lists[item.list_key] === 'undefined') {
        lists[item.list_key] = {
          "key": item.list_key,
          "name": item.list_key + "_name",
          "id": item.politician_id,
          "img": imgUrl(item.img),
          "candidates": {}
        };
      }

      names[item.list_key + '_name'] = item.party;

      lists[item.list_key].candidates[item.politician_key] = {
        "order": item.position,
        "key": item.politician_key,
        "status": item.status
      };

      if (item.status == 'substitute') {
        substitutes[item.politician_key] = {
          key: item.politician_key,
          politician_id: item.politician_id,
          full_name: item.full_name,
          img: imgUrl(item.img),
          order: item.position,
          status: item.status,
          has_answered: item.has_answered,
          completeness: item.completeness,
          list: item.party,
          total_questions: item.total_questions,
          total_received: item.total_received
        };

      } else {

        candidates[item.politician_key] = {
          key: item.politician_key,
          politician_id: item.politician_id,
          full_name: item.full_name,
          img: imgUrl(item.img),
          order: item.position,
          status: item.status,
          has_answered: item.has_answered,
          completeness: item.completeness,
          list: item.party,
          total_questions: item.total_questions,
          total_received: item.total_received
        };
      }
    });

    data.electoral_lists = Object.values(lists);

    data.electoral_lists.map((item) => {
      return item.candidates = Object.values(item.candidates);
    });

    data.candidates = Object.values(candidates);
    data.substitutes = Object.values(substitutes);

    data.i18n.en = names;
    data.i18n.nl = names;
    data.i18n.fr = names;

    res.json(data);
  });
});


/**
 * Get electoral districts (for given elected_authority)  , eg.:
 *      /v1/vote/electoral-districts.json   -> all
 *      /v1/vote/electoral-districts.json?reg=BERVL
 *      /v1/vote/electoral-districts.json?reg=BERBR
 *      /v1/vote/electoral-districts.json?reg=BERWA
 *      /v1/vote/electoral-districts.json?reg=BER   -> like BER%
 * @tag regional
 */
router.get("/v1/vote/electoral-districts.json", function (req, res) {

  const regauthority = req.query.reg;  //console.log(regauthority);

  // Return format data:
  let data = {
    "data": [],
    "i18n": { "en": {} , "fr": {} , "nl": {} }
  };

  let queryStr = `SELECT * FROM electoral_districts `;
  if (regauthority) {
    if (regauthority.len===5) queryStr += `WHERE Elected_Authority = '` +regauthority+ `'`;
    else {
      queryStr += `WHERE Elected_Authority LIKE '` +regauthority+ `%'`;
    }
  }

  db.query(queryStr, [], (err, rows) => {

    if (err) throw err

    rows.map((item) => {

      const name = "district_be_" + item.Elected_authority + "_" + item.id + "_name";

      const tmp = {
        "code": item.id,
        "key": "be_" + item.id,
        "name": name,
        "type": item.Elected_authority
      };

      data.data.push(tmp);
      data.i18n.en[name] = item.en;
      data.i18n.fr[name] = item.fr;
      data.i18n.nl[name] = item.nl;
    });

    return res.json(data);
  });
});



/**
 * Stats push stats into stats DB (/!\ different from POLDIR DB)
 *
 *
 * @tag municipal, regional
 */
router.all('/v1/stats', function (req, res) {

  var db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: "stats"
  });

  db.connect((err) => {
    if (err) throw err;

    let params = [
      req.query.age,
      req.query.source,
      req.query.party_vote,
    ];

    db.query("INSERT INTO stats (age,source,party_vote) VALUES (?,?,?)", params, (err, rows) => {

      if (err) throw err;

      console.log("Err", err, rows);

      res.json({
        'data': ['ok']
      });
    });
  });
});



/**
 * Stats push stats into stats DB (/!\ different from POLDIR DB)
 *
 *
 * @todo JM PUT the correct answers format
 * @tag municipal, regional
 */
router.get('/v1/answers/:key', function (req, res) {

  var db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: "stats"
  });

  db.connect((err) => {

    if (err) throw err;

    let key = req.params['key'];

    db.query("SELECT * from answers where id = ?", key, (err, rows) => {

      if (err) throw err;

      let row = rows[0];

      row.answers = JSON.parse(row.answers);

      return res.json(row);
    });
  });
});

/**
 * Just to check if the server response to a ping :-)
 */
router.get('/ping', function (req, res) {
  res.send('pong');
});

module.exports = router;