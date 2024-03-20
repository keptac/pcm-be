
/**
 * @param  {String} logMessage 
 * @param  {String} operation 
 * @param  {String} logType 
 */
module.exports = (logMessage, operation, logType) => {
    console.log('pcm-be - ' + Date() +' <'+ logType+'> '+operation+' ---------------| '+logMessage+' |---------------');
}
