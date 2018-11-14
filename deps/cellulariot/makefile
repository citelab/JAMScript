#==================================================================#
# @description: makefile for compiling sensor modules
# @author: Matthew L-K matthew.lesko-krlez@mail.mcgill.ca
# 
# Modification Log:
# Date                  Author                  Modification
# -----------------------------------------------------------------
# 23-Oct-2018           Matthew L-K             Created the file
# 31-Oct-2018           Samuel G                Added cellulariot-related tasks. Removed other tasks
#
#==================================================================#

# Define required macros here
SHELL = /bin/sh
CC = gcc
DIR_SRC = ./src/
DIR_TARGET = ./target/
CFLAG = -Wall
LIBS = -pthread -lpigpio -lrt

# Define targets here
cellulariot-deploy:
	clean
	cellulariot
	clean_intermediate

cellulariot: cellulariot.o SDL_Pi_HDC1000.o MMA8452Q.o Adafruit_ADS1x15.o
	${CC} ${CFLAG}

cellulariot.o : ${DIR_SRC}cellulariot.c
	${CC} ${CFLAG} $?

SDL_Pi_HDC1000.o : ${DIR_SRC}SDL_Pi_HDC1000.c ${DIR_SRC}SDL_Pi_HDC1000.h
	${CC} -c ${CFLAG} $<

MMA8452Q.o : ${DIR_SRC}MMA8452Q.c ${DIR_SRC}MMA8452Q.h
	${CC} -c ${CFLAG} $<

Adafruit_ADS1x15.o : ${DIR_SRC}Adafruit_ADS1x15.c ${DIR_SRC}Adafruit_ADS1x15.h
	${CC} -c ${CFLAG} $<

clean_intermediate :
	rm -f ${DIR_TARGET}*.o

clean : 
	rm -f ${DIR_TARGET}*

