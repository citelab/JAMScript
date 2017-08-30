This sample demonstrates an approach enabling communication between broadcaster and logger, using inflow and outflow.  
  
**inflow** folder  
A broadcaster called timeKeeping is declared.  
An inflow socket called inF is sitting there capturing data from an outflow called outF in app time.  
inF has a terminal function, which is executed when inF receives new data. This is where we chain the data to the broadcaster.  
  
**outflow** folder  
A logger called myClock is updated constantly by the C-node. A flow is built upon myClock with outF being its outflow. This outflow ejects data to all inflows listening to it.  

**Execution**  
```
cd outflow
jamc bcast-outflow.*
node jamout.js --app=time
open another tab in the same folder
./a.out -a time -n 1

cd ../inflow
jamc bcast-inflow.*
node jamout.js --app=AN_APP_NAME_YOU_LIKE
open another tab in the same folder
./a.out -a AN_APP_NAME_YOU_LIKE
```  
  
Now check out the C-side of inflow, the time is logged out every 5 seconds.