# 
# This is a parser for the generic header.. we should be able parse different
# headers using this parser (not completely, however)
# 
#

import re

# 
# header format:
# jamname {options} C_function_declaration {
# For example, use the following syntax in parsing the 'jamdef' header
# jamdef return_type function_name(param_list) {
#
# Use mainpat to match A (B) C
# A includes jamname {options} return_type function_name
# A could have two versions with and without pointer return_type
#
# B param_list is parsed by iterating using the parameter pattern
# Each parameter could have a pointer type as well (e.g., integer pointer)
# 
# C { - very easy!
# Optlist is actually optional!


class headerparser:

	def __init__(self, li):
		self.constname = ""
		self.funcname = ""
		self.rettype = None
		self.isrettypevalue = True
		self.params = []
		self.cline = li.strip()

	def parse(self):
		# patterns to match...
		mainpat = re.compile('(.*)\((.*)\)(.*)')
		pointerpat = re.compile('(.*)\*(.*)')
		parampat = re.compile('[^,]+')
		optionpat = re.compile('(.*)\{(.*)\}(.*)')

		# look for mainpat - this is a must.. not found report error and quit
		res = mainpat.search(self.cline)
		if res == None:
			print "ERROR! Unable to find matching brackets.."
			exit(0)

		consthead = res.group(1)
		param = res.group(2)
		consttail = res.group(3)
		
		# consthead -- jamname {options} return_type function_name

		# parse the options
		optparse = optionpat.search(consthead)
		if optparse == None:
			self.options = []
			# no options.. parse pointer return type
			pointparse = pointerpat.search(consthead)
			if pointparse == None:
				# just split based on ' '.. and this will give us the constructs and parameters
				pvalues = consthead.split()
				if len(pvalues) == 3:
					self.constname = pvalues[0]
					self.rettype = pvalues[1]
					self.funcname = pvalues[2]
				else:
					print "ERROR! Format invalid. (invalid return type spec.) " + self.cline
					exit(0)
			else:
				# pointer return type
				self.isrettypevalue = False
				pvalues = pointparse.group(1).split()
				self.constname = pvalues[0]
				self.rettype = pvalues[1]
				self.funcname = pointparse.group(2)
		else:
			# option is there.. first take the construct name - jamname
			self.constname = optparse.group(1)
			# get the options..
			for q in parampat.finditer(optparse.group(2)):
				[key, value] = q.group().split('=')
				self.options[key] = value

			# now the lastpart is return_type function_name
			# check if the return_type has a pointer_type
			pointparse = pointerpat.search(optparse.group(3))
			if pointparse == None:
				pvalues = optparse.group(3).split()
				self.rettype = pvalues[0]
				self.funcname = pvalues[1]
			else:
				self.rettype = pointparse.group(1)
				self.funcname = pointparse.group(2)

		# we have parsed up to and including the function_name
		# now we parse the param list
		for pdec in parampat.finditer(param):
			pstr = pdec.group()
			pointparse = pointerpat.search(pstr)
			if pointparse == None:
				pvalues = pstr.split()
				self.params.append({'type':pvalues[0], 'name':pvalues[1], 'value':True})
			else:
				self.params.append({'type':pointparse.group(1), 'name':pointparse.group(2), 'value':False})
		
		# we have completed the parsing now...
		# the values are found are already available in the properties of this object..


	# build a C version of the header...
	def makecheader(self):
		ostr = "("
		for p in self.params:
			if p["value"]:
				pstr = p["type"] + " " + p["name"]
			else:
				pstr = p["type"] + " *" + p["name"]
			if ostr == "(":
				ostr = ostr + pstr
			else:
				ostr = ostr + ", " + pstr
		ostr = self.funcname + ostr + ") {\n" 
		# assemble return type
		if self.isrettypevalue:
			retstr = self.rettype
		else:
			retstr = self.rettype + " *"

		return retstr + ostr

