# Mongo Migration
This application generates schemas based on MongoDB collections and migrates them to an SQL Database of choice (MySQL, PostgreSQL and Microsoft SQL Server)

To install all of the dependencies:
````
npm install
````
To run in development mode:

````
npm run serve
````

To compile and run in production, all you need is in the ./dist directory

````
npm run build
````

## Setup

Add to .env all the properties required
1. MongoDB connection URL
2. SQL database connection URL (check the Sequelize docs for the correct URL for the 3 providers)
3. MongoDB database name

## Description

1. It extracts all the collections' name from the MongoDB database
2. Creates schemas based on the documents of the collections
3. Creates table in the relational database with these schemas, with the help of sequelize models
4. Parses the documents with the help of the schema and inserts all of the rows representing the document

## Notes

Nested documents where represented as tables of their own, a recursive approach was used to generate schemas for the nested documents. For now only MongoDB Date objects where converted to String in order to insert them with Sequelize models.

Tests are required for more complex databases and nested documents

Beware of connection limit and memory consumption using the Sequelize connection
