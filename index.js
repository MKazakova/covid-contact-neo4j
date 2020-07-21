var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var neo4j = require('neo4j-driver');
var app = express();

app.set('views', path.join(__dirname, 'pages'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.listen(3000);

const driver = neo4j.driver('bolt://localhost', neo4j.auth.basic("neo4j", "neo4j"));
const session = driver.session();

app.get('/', async function(req, res){ 
        res.render('index', {person: "", people: ""});
});

app.get('/addpeople', async function(req, res){
        var persons = await calldbpers();
        res.render('addpeople', {people: persons});
});

app.get('/addmeeting', async function(req, res){
    var meetings = await calldbmeetings();
    res.render('addmeeting', {meetings: meetings});
});

app.post('/createPerson', async function(req, res){
        await createPerson(req.body);
        res.redirect('/');
})

app.post('/createMeeting', async function(req, res){
    var meeting = await createMeeting(req.body);
    res.render('meeting', {meeting: meeting, participants: []});
})

app.post('/addparticipant', async function(req, res){
    await addParticipant(req.body);
    var answer = await allParticipants(req.body.meeting_id);
    res.render('meeting', {meeting: answer.meeting, participants: answer.participants});
})

app.post('/searchPerson', async function(req, res){
    var person = await searchPerson(req.body);
    res.render('index', {person: person, people: ""});
})

app.post('/showContacts', async function(req, res){
    var person = await searchPerson(req.body);
    var people = await showContacts(req.body);
    res.render('index', {person: person, people: people});
})

app.get('/person/:id', async function(req, res){
    var id = req.params.id;
    var person = await searchPersonById(id);
    res.render('persondetails', {person: person});
})

app.post('/changeStatus', async function(req, res){
    var person = await changeStatus(req.body);
    res.render('persondetails', {person: person});
})

module.exports = app;


async function calldbpers(){
try {
        const result = await session.writeTransaction(tx =>
        tx.run(
            'MATCH (n:Person) RETURN n'
        ));
        var persons = [];

        const allRecords = result.records;
        allRecords.forEach(r => {
            persons.push({
                id: r._fields[0].identity.low,
                name: r._fields[0].properties.name,
                phone: r._fields[0].properties.phone,
                status: r._fields[0].properties.status,
            });
        });
        return persons;
      } catch(error) {
        console.log(error);
      }
}

async function calldbmeetings(){
    try {
            const result = await session.writeTransaction(tx =>
            tx.run(
                'MATCH (m:Meeting) RETURN m'
            ));
            var meetings = [];
    
            const allRecords = result.records;
            allRecords.forEach(r => {
                meetings.push({
                    id: r._fields[0].identity.low,
                    title: r._fields[0].properties.title,
                    date: r._fields[0].properties.date
                });
            });
            return meetings;
          } catch(error) {
            console.log(error);
          }
    }

async function createPerson(person){
    try {
            const result = await session.writeTransaction(tx =>
            tx.run(
                'CREATE (p:Person { name: $name, phone: $phone , status: $status}) RETURN p',
                { name: person.name, phone: person.phone, status: person.status }));
            
    } catch(error) {
            console.log(error);
    }
}

async function createMeeting(meeting){
    try {
            const result = await session.writeTransaction(tx =>
            tx.run(
                'CREATE (m:Meeting { title: $title, date: $date }) RETURN m',
                { title: meeting.title, date: meeting.date }));
            var meetingNode = result.records[0].get(0);

            return {
                title: meetingNode.properties.title,
                date: meetingNode.properties.date,
                id: meetingNode.identity.low
            };
    } catch(error) {
            console.log(error);
    }
}

async function addParticipant(participant){
    try {
            const result = await session.writeTransaction(tx =>
            tx.run(
                'MATCH (m:Meeting), (p:Person {phone: $phone}) WHERE id(m)=$id MERGE (p)-[:TAKE_PART_IN]->(m) RETURN p',
                { phone: participant.phone, id: parseInt(participant.meeting_id) }));
    } catch(error) {
            console.log(error);
    }
}

async function searchPerson(person){
    try {
            const result = await session.writeTransaction(tx =>
            tx.run(
                'MATCH (p:Person {phone: $phone}) RETURN p',
                { phone: person.phone}));
            var personNode = result.records[0].get(0);

            return {
                name: personNode.properties.name,
                phone: personNode.properties.phone,
                status: personNode.properties.status,
                id: personNode.identity.low
            };
    } catch(error) {
            console.log(error);
    }
}

async function searchPersonById(id){
    try {
            const result = await session.writeTransaction(tx =>
            tx.run(
                'MATCH (p:Person) WHERE id(p)=$id RETURN p',
                {id: parseInt(id)}));
            var personNode = result.records[0].get(0);

            return {
                name: personNode.properties.name,
                phone: personNode.properties.phone,
                status: personNode.properties.status,
                id: personNode.identity.low
            };
    } catch(error) {
            console.log(error);
    }
}

async function changeStatus(body){
    try {
            const result = await session.writeTransaction(tx =>
            tx.run(
                'MATCH (p:Person) WHERE id(p)=$id SET p.status = $status RETURN p',
                {id: parseInt(body.id), status: body.status}));
            var personNode = result.records[0].get(0);

            return {
                name: personNode.properties.name,
                phone: personNode.properties.phone,
                status: personNode.properties.status,
                id: personNode.identity.low
            };
    } catch(error) {
            console.log(error);
    }
}

async function showContacts(person){
    try {
            
            const result = await session.writeTransaction(tx =>
            tx.run(
                'MATCH (a:Person {phone: $phone})-[:TAKE_PART_IN]->(m:Meeting), (b:Person)-[:TAKE_PART_IN]->(m:Meeting) WHERE duration.inDays(date(m.date), date.transaction()).days<11 return DISTINCT b',
                { phone: person.phone}));
            var persons = [];

            const allRecords = result.records;
            
            allRecords.forEach(r => {
                    persons.push({
                        id: r._fields[0].identity.low,
                        name: r._fields[0].properties.name,
                        phone: r._fields[0].properties.phone
                    });
            });
            return persons;
    } catch(error) {
            console.log(error);
    }
}

async function allParticipants(id){
    try {
            const result = await session.writeTransaction(tx =>
            tx.run(
                'MATCH (p)-[:TAKE_PART_IN]->(m:Meeting) WHERE id(m)=$id RETURN p, m',
                { id: parseInt(id) }));
                var participants = [];
                const allRecords = result.records;
                allRecords.forEach(r => {
                    participants.push({
                        id: r._fields[0].identity.low,
                        name: r._fields[0].properties.name,
                        phonr: r._fields[0].properties.phone
                    });
                });
                var meetingNode = result.records[0].get(1);
                return { participants: participants, 
                         meeting: {
                            title: meetingNode.properties.title,
                            date: meetingNode.properties.date,
                            id: meetingNode.identity.low
                        }};
    } catch(error) {
            console.log(error);
    }
}