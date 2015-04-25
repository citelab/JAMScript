# 
# Create a jamdefheader class.
#


class jamdefheader:
	def __init__(self, header, cfp, jsfp):
		# save all the parameters in 'member' values
		self.header = header
		self.cfp = cfp
		self.jsfp = jsfp
	
	def outputcheader(self):
		# this creates the C header and outputs to cfp
		
		# initialize an instance of a generic parser
		self.head = headerparser(self.cline)
		# parse the line.. now the values are loaded properly
		self.head.parse()
		
		# TODO: do something with the header options

		# TODO: Parse the body of the function.. check for parameter use
		# TODO: Check for JavaScript use... if it is not JavaScript, we need to report ERROR
		

	def getreturntype(self):
		return dict(type=self.head.rettype, ispointer= not self.head.isrettypevalue)

	# build a C version of the header...
	def makecheader(self):
		return self.head.makecheader()

	# build the 'call_user_def' function call..
	def makeuserdefcall(self):
		ostr = "call_user_def(app, "
		ostr = ostr + "\"" + self.head.funcname + "\""
		fmt = "\""
		pargs = ""
		count = 0
		if len(self.head.params) == 1:
			return ostr + ", NULL);"
		ostr = ostr +", "
		for p in self.head.params:
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

			if p == self.head.params[len(self.head.params) -1]:
				pargs = pargs + p["name"]
			else:
				pargs = pargs + p["name"] + ", "

		fmt = fmt + "\", "
		ostr = ostr + fmt + pargs + ");"
		return ostr

	def makejsfunction(self):
		ostr = "function "
		ostr = ostr + self.head.funcname +"("
		pargs = ""
		count = 0
		for p in self.head.params:
			count = count + 1
			if count == 1:
				continue
			if p == self.head.params[len(self.head.params) -1]:
				pargs = pargs + p["name"]
			else:
				pargs = pargs + p["name"] + ", "

		ostr = ostr + pargs + ") {\n"
		return ostr
