FROM ubuntu
RUN apt-get update && apt-get install -y wget \
        build-essential \
        python \
        unzip \
        libbsd-dev \
        git \
        sudo \
        vim
RUN git clone https://github.com/anrl/JAMScript-beta && cd JAMScript-beta/tools && git checkout master && git pull && cd ../samples && git checkout master && git pull && cd ../scripts/install && cp jamscript-on-docker.sh ../..  && cp depend-docker.sh ../.. && cd ../..  && ./depend-docker.sh && ./jamscript-on-docker.sh
CMD chmod -R a+Xr /etc/avahi && sed -i "s|rlimit-nproc=3|#rlimit-nproc=3 |g" /etc/avahi/avahi-daemon.conf && cd /var/run/ && rm -rf dbus && mkdir dbus && dbus-daemon --system &&  avahi-daemon
