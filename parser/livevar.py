import re


class liveHeader:
	table = {}
	def __init__(self, li):
		self.funcname = ""
		self.params = []
		self.cline = li.strip()

	def parseheader(self):


		tokens = self.cline.split(' ')
		if tokens[0] != "live":
			print "Error!! Illegal use of live.. " + self.cline
			exit(0)
		if ";" in tokens[2]:
			stkns = tokens[2].split(";")
			liveHeader.table[stkns[0]] = tokens[1]
		
			return tokens[1]+' '+tokens[2]+'\n'
		else:
			liveHeader.table[tokens[1]] = tokens[2]
			return tokens[1]+' '+tokens[2] + ' ' + tokens[3] + '\n'

	def assignstmt(self):
		tokens = self.cline.split(' ')

		va = re.sub('; *', '', re.sub('[0-9a-zA-Z_ ]+=', '', self.cline))
		#va = ''
		stkns = tokens[0].split("=")
		if '=' not in tokens[0]:
			stkns[0] = tokens[0]			
		print "Printing table"
		print liveHeader.table
		if stkns[0] in liveHeader.table:
			if liveHeader.table[stkns[0]] == 'int':
				var_type = 'i'
			elif liveHeader.table[stkns[0]] == 'char':
				var_type = 'c'
			elif re.match('char *\*{1}', liveHeader.table[stkns[0]]):
				var_type = 's'
			elif liveHeader.table[stkns[0]] == 'float':
				var_type = 'f'
			elif liveHeader.table[stkns[0]] == 'double':
				var_type = 'd'
			return self.cline + '\n' + 'update(display, "' + stkns[0] + '", "' + var_type + '", ' + va + ');' + '\n'
		else:
			return self.cline + '\n'
