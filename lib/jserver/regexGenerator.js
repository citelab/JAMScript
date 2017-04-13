//==============================================================================
// Generates a regular expression to match on an MQTT topic
//==============================================================================

/**
 * takes as input a topic string and returns a regular expression for the topic
 */
function getRegex(topic) {
    // for any '/', replace with '\/'
    topic = topic.replace(new RegExp('\\/', 'g'), '\\/');

    // replace any '+' with [a-zA-Z0-9_-]+
    topic = topic.replace(new RegExp('\\+', 'g'), '[a-zA-Z0-9_-]+');

    // replace any '#' with ([a-zA-Z0-9_-]+|[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)+
    topic = topic.replace(new RegExp('#', 'g'), '[a-zA-Z0-9_-]+(\\/[a-zA-Z0-9_-]+)*');

    // prepend '^' to the front and '$' to the end
    topic = '^' + topic + '$';

    // return the RegExp
    return new RegExp(topic);
}

var topicRegExp = new RegExp('^([a-zA-Z0-9_-]+|\\+)(\\/([a-zA-Z0-9_-]+|\\+))*(\\/#)?$');

/**
 * returns true if the topic is allowed and false otherwise
 */
function isValidTopic(topic) {
    return topicRegExp.test(topic);
}

module.exports = {
    getRegex: getRegex,
    isValidTopic: isValidTopic
}
