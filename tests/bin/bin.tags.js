function parse() {
  return true;
}

function compile(compiler, args, content) {
  return compiler(content) + '\n' +
    '_output += " tortilla!";';
}

exports.tortilla = {
  parse: parse,
  compile: compile,
  ends: true
};
