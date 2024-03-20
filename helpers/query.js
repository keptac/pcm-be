module.exports = async (connection, sql, params) => {
  try {
    const results = await new Promise((resolve, reject) => {
      connection.query(sql, params, (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
    return results;
  } catch (error) {
    console.error('Query Error:', error);
    throw error; 
  }
};
