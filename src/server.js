import cron from 'cron'
import migration from './migration'
import Sequelize from 'sequelize'
import fs from 'fs';

// Regular cron job, will be executed at 4 am
let task = new cron.CronJob({
  cronTime: '00 00 * * * *',
  onTick: function() {
    databaseMigration()
  },
  start: true,
  timezone: 'America/El_Salvador'
})

task.start()

function databaseMigration() {
  console.log("Migration started at " + new Date() + " **************")

  /*Create the sequelize connection*/
  let sequelize = new Sequelize(process.env.SQL_URL, {logging: false})
  console.log("Connected to SQL DB")

  var sequelizeDb = {}
  sequelizeDb.sequelize = sequelize
  sequelizeDb.Sequelize = Sequelize

  // Connection done
  migration.getCollectionNames().then((collectionNames)=>{
    console.log('Collection names recovered')

    let tablesPromises = []
    for (var i = 0; i < collectionNames.length; i++) {
      tablesPromises.push(migration.initiateTable(collectionNames[i], sequelizeDb))
    }

    Promise.all(tablesPromises).then(()=>{
      console.log("Creating tables...")
      //Data is streamed
      sequelizeDb.sequelize.sync({force: true}).then(()=>{
        // Tables were created
        console.log('Tables created');
        let promises = []

        for (var i = 0; i < collectionNames.length; i++) {
          promises.push(migration.fillTable(collectionNames[i], sequelizeDb))
        }

        Promise.all(promises).then(()=>{
          // All done
          console.log('All rows inserted');

					let message = "Migration successfull at " + new Date() + " \r\n"

          console.log(message)

					fs.appendFile("logs.txt", message, (err)=>{
						if(err) console.log(err);
						else console.log("Log saved!");
					});
          /*You can send an email, slack notification or kafka message when its done*/
        })
      })

    })

  }).catch(err=>{
    console.log('Error on method');
    console.log(err);
  })

}

databaseMigration()
