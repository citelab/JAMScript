#
# JAMScript 1.0 parser module...
#
#
#
#
import re
import sys
from headerparser import headerparser


# Lets use some global variables... I know it is not the best decision!

functionType = ' '

scope = 0
ofp = None
header = None
oheader = None


def processclosebrackets(l, cfp, jsfp):
	global scope
	global functionType
	global ofp

	# Catch close brackets
	if re.match(r'(.*)}(.*)', l):
		if scope <= 0:
			print "Unexpected } found"
			exit(0)
		if scope == 1:
			if functionType == 'jamdef':
				# close the stream
				if ofp == jsfp:
					jsfp.write("}\n");
					ofp = cfp
				# reset the functionType
				functionType = ' '
			# Do other function type specific processing as needed..
			#
		scope -= 1
# end of processclosebrackets()


def jamparser(ifp, cfp, jsfp):

	global functionType
	global scope
	global ofp

	jamheadercont = False
	onheadercont = False
	savedl = ""

	# starts with comment mode false
	incomment = False
	# start with C as the default file.. all output goes there
	ofp = cfp

	# iterate over the file.
	for l in ifp:
		# output an indicator to the standard output
		sys.stdout.write(".")

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

		# check for 'jam' headers...
		if (jamheadercont or re.match(r'(\s*)jam([a-z]+)(\s+)', l)):

			# 'jam' header cannot appear inside a nested scope - report an error and exit
			if scope != 0:
				print "ERROR! 'jam' header cannot occur inside a nested scope"
				exit(0)

			# accumulate lines if begin of the function body '{' is not found
			if not re.match(r'(.*){(\s*)$', l):
				jamheadercont = True
				savedl = savedl + l
				# skip to next line.. we saved the current line
				continue
			else:
				savedl = savedl + l
				savedll = re.sub('\n', ' ', savedl)
				savedl = ""
				jamheadercont = False

				# process the header in the
				header = headerparser(savedll)
				header.parse()
				header.printheader()

				# increment the scope .. we are getting into the jamxxx scope
				scope += 1

				# perform 'jam' header specific processing..
				if header.constname == "jamdef":
					functionType = header.constname
					cfp.write(header.makeCheader())
					cfp.write(header.getRegisterException())
					cfp.write(header.makeCallstatement())
					cfp.write(header.getDeRegisterException())
					jsfp.write(header.makeJSheader())
					# rest of the lines go to JS file until the scope is closed
					ofp = jsfp
				elif header.constname == "jammodel":
					print "Processing jammodel"
				elif header.constname == "jamcall":
					print "Processing jamcall"
				elif header.constname == "jamlisten":
					print "Processing jamlisten"
				elif header.constname == "jamsay":
					print "Processing jamsay"
				elif header.constname == "jamrequire":
					print "Processing jamrequire"
				elif header.constname == "jamtry":
					print "Processing jamtry"
				elif header.constname == "jamexception":
					print "Processing jamexception"
				continue
		# End checking 'jam' headers...

		# check 'onreturn' constructs..
		if (onheadercont or re.match(r'([\}]*)(\s*)on([a-z]+)(\s+)', l)):
			# get previous context... we haven't reset it.
			# previous header gets reset when we close the scope that was started by the construct..

			# accumulate lines if begin of the function body '{' is not found
			if not re.match(r'(.*){(\s*)$', l):
				onheadercont = True
				savedl = savedl + l
				# skip to next line.. we saved the current line
				continue
			else:
				savedl = savedl + l
				savedll = re.sub('\n', ' ', savedl)
				savedl = ""
				onheadercont = False

				# process the header in the
				oheader = headerparser(savedll)
				oheader.oparse()

				# perform onheader specific processing..
				if onheader.constname == "onreturn":
					# onreturn processing..
					print "Onreturn found.. processing it.."
				elif onheader.constname == "onexception":
					print "Onexception found .. processing it .."


		# End check onheader...

		# Catch open brackets .. this is triggered for subsequent open '{'
		# first one is captured by the jamX construct itself..
		if re.match(r'(.*){(.*)', l):
			scope += 1

		processclosebrackets(l, cfp, jsfp)

		# Output the line to the default output..
		ofp.write(l)

	# End looping through the input file
	print "done."
# End of jamparser
