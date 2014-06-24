# 
# Create a jsdef Header class.
# Populate all the parameters of the command line
#

import re


class JSdefHeader:
	def __init__(self, li):
		self.funcname = ""
		self.params = []
		self.cline = li.strip()

	def parseheader(self):

		tokens = self.cline.split(' ');
		if tokens[0] != "jsdef":
			print "Error!! Illegal JSDefinition.. " + self.cline
			exit(0)

		if "(" in tokens[1]:
			stkns = tokens[1].split("(")
			self.funcname = stkns[0]

		ppat = re.search(r'\((.*)\)', self.cline)
		if ppat==None:
			print "Error!! Unable to find matching brackets.."
			exit(0)

		pstr = ppat.group()
		qstr = pstr[1:len(pstr)-1]

		if len(qstr) < 4:
			# no parameters specified...
			return

		for tkn in qstr.split(","):
			# process tkn and make dictionary in params
			tkn = tkn.strip()
			qs = tkn.split(' ')
			if len(qs) == 3:
				self.params = self.params + [dict(value=False, type=qs[0], name=qs[1])]
			elif "*" in qs[0]:
				qss = qs[0].split("*")
				self.params = self.params + [dict(value=False, type=qss[0], name=qs[1])]
			elif "*" in qs[1]:
				qss = qs[1].split("*")
				self.params = self.params + [dict(value=False, type=qs[0], name=qss[1])]
			else:
				self.params = self.params + [dict(value=True, type=qs[0], name=qs[1])]

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
		ostr = "void " + self.funcname + ostr + ") {\n" 
		return ostr

	def makeuserdefcall(self):
		ostr = "call_user_def(display, "
		ostr = ostr + "\"" + self.funcname + "\""
		fmt = "\""
		pargs = ""
		count = 0
		if len(self.params) == 1:
			return ostr + ", NULL);"
		ostr = ostr +", "
		for p in self.params:
			count = count + 1
			if count == 1:
				continue
			if p["type"] == "int":
				fmt = fmt + "i"
			elif p["type"] == "double":
				fmt = fmt + "d"
			elif p["type"] == "float":
				fmt = fmt + "f"
			elif p["type"] == "long":
				fmt = fmt + "l"
			elif p["type"] == "char" and not p["value"]:
				fmt = fmt + "s"

			if p == self.params[len(self.params) -1]:
				pargs = pargs + p["name"] 
			else:
				pargs = pargs + p["name"] + ", "

		fmt = fmt + "\", "
		ostr = ostr + fmt + pargs + ");"
		return ostr


	def makejsfunction(self):
		ostr = "function "
		ostr = ostr + self.funcname +"("
		pargs = ""
		count = 0
		for p in self.params:
			count = count + 1
			if count == 1:
				continue
			if p == self.params[len(self.params) -1]:
				pargs = pargs + p["name"]
			else:
				pargs = pargs + p["name"] + ", "

		ostr = ostr + pargs + ") {\n"
		return ostr

	
	    
	
	
	





	
	
	
	



