import mongodb from 'mongodb'
import dotenv from 'dotenv'
dotenv.config()

const mongo = mongodb.MongoClient

// Recovers all collections, be careful with the mongo connections, memory usage untested
function getCollectionNames() {
  return new Promise((resolve, reject)=>{

    mongo.connect(process.env.MONGO_URL, (err, client)=>{

      if(err){
        console.log(err);
        reject(err)
      }
      let database = client.db(process.env.MONGO_DB_NAME)
      let collectionNames = []
      /*Streaming the collection*/
      /*Create all the tables*/
      database.listCollections().toArray((err, collections)=>{
        for (var i = 0; i < collections.length; i++) {
          let collName = collections[i].name
          if(collName !== 'system.indexes'){
            collectionNames.push(collName)
          }
        }
        resolve(collectionNames)
      })
    })
  })
}

// Created a sequelize model based on data extracted by getSchema
function initiateTable(collName, sequelizeDb) {
  return new Promise((resolve, reject)=>{

    mongo.connect(process.env.MONGO_URL, (err, client)=>{

      if(err){
        console.log(err);
        reject(err)
      }

      let database = client.db(process.env.MONGO_DB_NAME)

      // We get a document from the collection to create a schema, this works assuming all documents are equal
      database.collection(collName).find().limit(1).forEach(document=>{
          getSchema(document, sequelizeDb, collName)
		  resolve()
      })
    })
  })

}

// Maps a schema from the document
// 'obj' represents a document
// sequelizeDb is a sequelize connection
// name and parent are optional attributes in order to make the recursion work as designed
// name is the collection name, which will be the table named
// parent is the collection parent name
function getSchema(obj, sequelizeDb, name=null, parent=null) {
    let table = {}
    if(obj.length > 1) obj = obj[0]
    if(parent){
      table[parent+'_id'] = 'string'
      name = parent + "_" + name
    }

    for (var key in obj) {
        if(typeof obj[key] != "function"){     //we don't want to print functions
            var specificDataTypes=[Date,Array];    //specify the specific data types you want to check
            var type ="";
            for(var i in specificDataTypes){       // looping over [Date,Array]
                if(obj[key] instanceof specificDataTypes[i]){      //if the current property is instance of the DataType
                        type = specificDataTypes[i].name
                        break;
                }
            }

            if(key === '_id') table['_id'] =  'string'
            else if(key === 'id') table[name+"_id"] = 'string'
            else if(!obj[key]) table[key] = 'string'
            else if (typeof obj[key] == "object") {
              switch (type) {
                case 'Date':
                  table[key] = 'date'
                  break;
                case 'Array':
                  getSchema(obj[key], sequelizeDb, key, name) //Recursive approach
                  break;
                default:
                  getSchema(obj[key], sequelizeDb, key, name)
              }
            }
            else{
                table[key] =  typeof obj[key]
            }
        }
    }

    createTable(table, sequelizeDb, name)
}


// Creates a table based on a javascript object representing a collection schema
// schema is the model schema
// conn represents the sequelize connection
// modelName is the table name
function createTable(schema, conn, modelName) {
  //Sequelize is the npm module
  //sequelize is the connection

  for(var key in schema){
    // Converts the mongodb datatype to a Sequelize datatype
    switch (schema[key]) {
      case 'string':
        schema[key] = {type: conn.Sequelize.STRING(1500)}
        break;
      case 'date':
        schema[key] = {type: conn.Sequelize.DATE}
        break;
      case 'number':
        if(schema[key] === parseInt(schema[key], 10)) schema[key] = {type: conn.Sequelize.INTEGER}
        else schema[key] = {type: conn.Sequelize.DOUBLE}
        break;
      default:
        schema[key] = {type: conn.Sequelize.STRING(1500)}
    }
  }

  // Creates a sequelize model
  const model = conn.sequelize.define(modelName, schema, {freezeTableName: true})
  conn[model.name] = model

  return model
}

// Creates a table row based on a documents
// name is the collection and table named
// sequelizeDb is the sequelize collection
// Uses data streams to avoid massive memory usage while querying possibly huge mongodb collections
function fillTable(name, sequelizeDb) {
  return new Promise((resolve, reject)=>{
    mongo.connect(process.env.MONGO_URL, (err, client)=>{
        if(err){
          console.log(err);
          reject(err)
        }

        let database = client.db(process.env.MONGO_DB_NAME)

        let dataStream = database.collection(name).find({}).stream()

        dataStream.on('data', (doc)=>{
          dataStream.pause()
          /*Insert this into an SQL database and resume the stream*/
          var promiseArray = []
          insertRow(doc, name, sequelizeDb, promiseArray)
          Promise.all(promiseArray).then(()=>{
            // All insertions for one document have been done
            dataStream.resume()
          })
        })

        dataStream.on('end', ()=>{
          client.close()
          resolve()
        })

    })
  })
}

// Does the database insertion, works similar to getSchema
// obj is the document recovered from the database
// name is the table name
// sequelizeDb is the sequelize connection
// promiseArray is an array containing all the promises that will be later executed to do the actual insertion
// parent represents the parent table id
function insertRow(obj, name, sequelizeDb, promiseArray, parentName=null, parentId=null) {
  let table = {}
  if(obj.length > 1) obj = obj[0]
  if(parentName){
    table[parentName + '_id'] = parentId.toString()
    name = parentName + "_" + name
  }
  for (var key in obj) {
      if(typeof obj[key] != "function"){     //we don't want to print functions
          var specificDataTypes=[Date,Array];    //specify the specific data types you want to check
          var type ="";
          for(var i in specificDataTypes){       // looping over [Date,Array]
              if(obj[key] instanceof specificDataTypes[i]){      //if the current property is instance of the DataType
                      type = specificDataTypes[i].name
                      break;
              }
          }

          if(key === '_id') table['_id'] =  obj['_id'].toString()
          else if(key === 'id') table[name+"_id"] = obj['id'].toString()
          else if(!obj[key]) table[key] = null
          else if (typeof obj[key] == "object") {
            switch (type) {
              case 'Date':
                table[key] = obj[key].toString()
                break;
              case 'Array':
                insertRow(obj[key], key, sequelizeDb, promiseArray, name, obj['_id'] || parentId || "N/A")
                break;
              default:
                insertRow(obj[key], key, sequelizeDb, promiseArray, name, obj['_id'] || parentId || "N/A")
            }
          }
          else{
              table[key] =  obj[key]
          }
      }
  }

  // We create the promise to insert the row with the custom schema
  promiseArray.push(sequelizeDb[name].create(table))


}




export default { initiateTable, getCollectionNames, fillTable }
