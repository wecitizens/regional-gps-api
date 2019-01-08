var express = require('express');
var router = express.Router();
var db = require('../db');
var fs = require('fs');

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

router.get('/v1/gps/answer/segment/2018_be_municipal_be_:key.json', function (req, res) {

  let key = req.params['key'];

  if (key.includes('_electoral_list')) {

    key = key.replace('_electoral_list', '');
    const district = 'BE' + key;

    let electoralListQuery = `
SELECT DISTINCT
    a.id,
    CONCAT('2018_be_municipal_be_', '` + key + `') AS segment_key,
    'electoral_list' AS segment_type,
    CONCAT('be_', replace(e.district,'BE',''), '_', lower(replace(replace(party.abbr,'! &',''),' ','_'))) AS user_key,
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
        LEFT JOIN
    localite_menu ON localite_menu.id_gps = election.id_gps
WHERE
    e.district = ?
    AND e.id_election >= 16  
    AND a.id_politician != 5439
    AND a.opinion_id in ('4','14','20','21','22','23','31','38','46','49','52','58','84','88','89','90','93','95','96','97','98','99','100','101','102','103','104','105','106','107','108','110','112','113','114','115','116','117','118','119','120','121','123','124','125')
    AND a.opinion_answer in ('1','2','3','4','5')
    AND party.abbr <> 'Other party'    
    AND p.personal_gender in ('i')
ORDER BY opinion_received DESC
  `;
    console.log(electoralListQuery);

    db.query(electoralListQuery, district, function (err, rows) {
      if (err) throw err;
      res.json({data: rows});
    });

  } else {
    key = key.replace('_candidate', '');
    const district = 'BE' + key;

    let candidateQuery = `
SELECT DISTINCT
    a.id,
    CONCAT('2018_be_municipal_be_', '` + key + `') AS segment_key,
    'candidate' AS segment_type,
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
        INNER JOIN
    localite_menu ON localite_menu.id_gps = election.id_gps  
WHERE
    a.id_politician != 5439 # Jean-Paul
    AND e.id_election >= 16
    AND e.district = ?
    AND a.opinion_answer in ('1','2','3','4','5')
    AND a.opinion_id in ('4','14','20','21','22','23','31','38','46','49','52','58','84','88','89','90','93','95','96','97','98','99','100','101','102','103','104','105','106','107','108','110','112','113','114','115','116','117','118','119','120','121','123','124','125')
    AND p.personal_gender in ('m','f')
    ORDER BY opinion_received DESC
  `;
    console.log(candidateQuery);

    db.query(candidateQuery, district, function (err, rows) {
      if (err) throw err;

      res.json({data: rows});
    });
  }
});

router.get('/v1/vote/election/2018_be_municipal/district/be_:key.json', function (req, res) {

  let key = req.params['key'];
  const district = 'BE' + key;

  db.query(`SELECT 
    MAX(segment_key) as segment_key,
    MAX(segment_type) as segment_type,
    MAX(list_key) as list_key,
    MAX(politician_key) as politician_key,
    id_politician AS politician_id,
    MAX(full_name) as full_name,
    MAX(img) as img,
    MAX(party) as party,
    MAX(position) as position,
    MAX(status) as status,
    MAX(has_answered) as has_answered,
    MAX(id_election) as id_election,
    MAX(completeness) as completeness,
    MAX(total_questions) as total_questions,
    MAX(total_received) as total_received
FROM
    (SELECT 
        segment_key,
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
    FROM
        (SELECT DISTINCT
        NULL AS segment_key,
            NULL AS segment_type,
            NULL AS list_key,
            NULL AS politician_key,
            a.id_politician,
            NULL AS full_name,
            NULL AS img,
            NULL AS party,
            NULL AS position,
            NULL AS status,
            0 AS has_answered,
            0 AS id_election,
            0 AS completeness,
            0 AS total_questions,
            a.opinion_id AS question_key
    FROM
        opinions_answers a
    INNER JOIN politician p ON p.id = a.id_politician
    INNER JOIN politician_election e ON e.id_politician = a.id_politician
    INNER JOIN election ON election.id = e.id_election
    INNER JOIN localite_menu ON localite_menu.id_gps = election.id_gps
    WHERE
        a.id_politician != 5439
            AND e.id_election >= 16
            AND e.district = ?
            AND a.opinion_answer IN ('1' , '2', '3', '4', '5')
            AND a.opinion_id IN ('4' , '14', '20', '21', '22', '23', '31', '38', '46', '49', '52', '58', '84', '88', '89', '90', '93', '95', '96', '97', '98', '99', '100', '101', '102', '103', '104', '105', '106', '107', '108', '110', '112', '113', '114', '115', '116', '117', '118', '119', '120', '121', '123', '124', '125')
            AND p.personal_gender IN ('m' , 'f', 'i')
    ORDER BY opinion_received DESC) segment
    GROUP BY segment_key , segment_type , list_key , politician_key , id_politician , full_name , img , party , position , status , has_answered , id_election , completeness , total_questions UNION SELECT 
        CONCAT('2018_be_municipal_be_', REPLACE(localite_menu.postcodes_principal, '.000', '')) AS segment_key,
            (CASE
                WHEN p.personal_gender = 'm' THEN 'candidate'
                WHEN p.personal_gender = 'f' THEN 'candidate'
                WHEN p.personal_gender = 'i' THEN 'electoral_list'
                ELSE 'wrong'
            END) AS segment_type,
            CONCAT('be_', REPLACE(e.district, 'BE', ''), '_', LOWER(REPLACE(REPLACE(party.abbr, '! &', ''), ' ', '_'))) AS list_key,
            CONCAT('be_politician_', p.id) AS politician_key,
            p.id AS politician_id,
            CONCAT(p.name, ' ', p.surname) AS full_name,
            pic.full_path AS img,
            party.abbr AS party,
            e.place AS position,
            e.status AS status,
            e.questionnaire AS has_answered,
            e.id_election AS id_election,
            p.completeness_of_profile AS completeness,
            45 AS total_questions,
            0 AS total_received
    FROM
        politician_election e
    JOIN politician_job j ON j.id_politician = e.id_politician
    JOIN politician p ON p.id = e.id_politician
    LEFT JOIN party party ON party.id = e.roll
    LEFT JOIN politician_photos pic ON pic.id_politician = e.id_politician
    JOIN election ON election.id = e.id_election
    LEFT JOIN localite_menu ON localite_menu.id_gps = election.id_gps
    WHERE
        e.district = ?
            AND e.id_election >= 16
    GROUP BY e.id_politician) all_together
GROUP BY id_politician
ORDER BY id_politician DESC`, [district,district], (err, rows) => {

    /**
     * @TODO => activate e.questionnaire = 1 when candidates answers to everything
     */

    if (err) {
      throw  err;
    }

    let data = {
      "key": "2018_be_municipal_" + key,
      "type": "be_municipal",
      "type_name": "election_type_be_municipal_name",
      "date": "2018-10-14T00:00:00.000Z",
      "main_election_key": "2018_be_municipal",
      "district_key": "be_municipal_" + key,
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
    });

    data.electoral_lists = Object.values(lists);

    data.electoral_lists.map((item) => {
      return item.candidates = Object.values(item.candidates);
    });

    data.candidates = Object.values(candidates);

    data.i18n.en = names;
    data.i18n.nl = names;
    data.i18n.fr = names;

    res.json(data);
  });
});

router.get('/v1/vote/district.json', function (req, res) {
  //let key = req.params['key'];
  res.json({});
});

router.all('/v1/stats', function (req, res) {

  console.log('req', req);

  let json = JSON.stringify(req.params);

  fs.writeFile('./public/stats/'+Date.now() + '.json', json, 'utf8');

  res.json({
    'data': ['ok']
  });
});

/**
 * Just to check if the server response to a ping :-)
 */
router.get('/ping', function (req, res) {
  res.send('pong');
});

module.exports = router;