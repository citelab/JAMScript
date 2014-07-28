# 
# JAMScript 1.0 parser module...
# 
# 
# 
# 
import re
from jamdefheader import jamdefheader


# Lets use some global variables... I know it is not the best decision!

functionType = ' '

jamdefcont = False
jamcallcont = False
jammodelcont = False
jamlistencont = False
jamsaycont = False
jamrequirecont = False

scope = 0
savedl = ''

ofp = None

def parsejamdef(l, cfp, jsfp):
	global functionType
	global jamdefcont
	global scope
	global savedl
	global ofp
	
	functionType = 'jamdef'
	jamdefcont = True
	# jamdef cannot be detected inside a nested scope .. report error and terminate
	if scope != 0:
		print "ERROR! jamdef cannot occur inside a nested scope"
		exit(0)

	# accumulate lines if begin of the function body '{' is not found
	if not re.match(r'(.*){(\s*)$', l):
		savedl = savedl + l
		# skip to next line.. we saved the current line
		return
	else:
		savedl = savedl + l
		savedll = re.sub('\n', ' ', savedl)
		savedl = ""
		jamdefcont = False

	# now parse the jamdef command .. this would read until the start of the scope -- "{"
	header = jamdefheader(savedll)
	scope += 1
	header.parseheader()
	jsfp.write(header.makejsfunction())
	ofp = jsfp
	print header.head.params
	print header.head.funcname
	cfp.write(header.makecheader())
	cfp.write(header.makeuserdefcall())

	# Now skip to the next iteration.. we have processed this input line..
	return

def parseonreturn(l, cfp):
	global onreturncont
	global savedl
	global scope

	# onreturn header is in multiple lines, we need to parse it..
	if onreturncont:
		if not re.match(r'(.*){(\s*)$', l):
			savedl = savedl + l
			return
		else:
			savedl = savedl + l
			savedll = re.sub('\n', ' ', savedl)
			onreturncont = False

			# now parse the onreturn command ..
			header = onreturnheader(savedll)
			scope += 1
			header.parseheader()
			cfp.write(header.makecheader())
			return
	# onreturn function processing...

def processclosebrackets(l, cfp, jsfp):
	global scope
	global functionType
	global ofp

	# Catch close brackets
	if re.match(r'(.*)}(.*)', l):
		if scope <= 0:
			print "Unexpected } found"
			exit(0)
		if scope == 1 and functionType == 'jamdef':
			# close the stream
			if ofp == jsfp:
				jsfp.write("}\n");
				ofp = cfp
			functionType = ' '
			# completing the jamdef.. check 'onreturn' clause
			if re.match(r'(\s*)}(\s*)onreturn(\s+)', l):
				onreturncont = True
				functionType = 'onreturn'
				if not re.match(r'(.*){(\s*)$', l):
					savedl = savedl + l
					return
				else:
					savedl = savedl + l
					savedll = re.sub('\n', ' ', savedl)
					onreturncont = False

				# now parse the onreturn command ..
				header = onreturnheader(savedll)
				scope += 1
				header.parseheader()
				cfp.write(header.makecheader())
			
		if scope == 1 and (functionType == 'jammodel' or
				   functionType == 'jamlisten' or
				   functionType == 'jamsay' or
				   functionType == 'jamcall'):
			functionType = ' '
		scope -= 1
	return
# end of processclosebrackets()


def jamparser(ifp, cfp, jsfp):

	global functionType
	global scope
	global jamdefcont
	global jamcallcont
	global jammodelcont
	global jamlistencont
	global jamsaycont

	global ofp

	incomment = False
	# start with C as the default file.. all output goes there
	ofp = cfp

	# iterate over the file.
	for l in ifp:
		# Comment parsing.. nothing inside a comment section is parsed..
		# at this point, /*.. */ comments are detected.
		# TODO: handle // comments as well..
		if re.match(r'/\*(\s*)', l):
			incomment = True
		if re.match(r'(\s*)(\*)+/', l):
			incomment = False
		
		# if comment just dump the comment to the current ofp and skip to next line
		if incomment:
			ofp.write(l)
			continue
		if (jamdefcont or re.match(r'(\s*)jamdef(\s+)', l)):
			parsejamdef(l, cfp, jsfp)
			continue
		if (jammodelcont or re.match(r'(\s*)jammodel(\s+)', l)):
			parsejammodel(l)
			continue
		if (jamcallcont or re.match(r'(\s*)jamcall(\s+)', l)):
			parsejamcall(l)
			continue
		if (jamsaycont or re.match(r'(\s*)jamsay(\s+)', l)):
			parsejamsay(l)
			continue
		if (jamlistencont or re.match(r'(\s*)jamlisten(\s+)', l)):
			parsejamlisten(l)
			continue
		if (jamrequirecont or re.match(r'(\s*)jamrequire(\s+)', l)):
			parsejamrequire(l)
			continue


		# we are 'onreturn' so enter to process it..
		if functionType == 'onreturn':
			parseonreturn(l, cfp, jsfp)
			
		# Catch open brackets .. this is triggered for subsequent open '{' 
		# first one is captured by the jamX construct itself..
		if re.match(r'(.*){(.*)', l):
			scope += 1

		processclosebrackets(l, cfp, jsfp)

		# Output the line to the default output..
		ofp.write(l)







