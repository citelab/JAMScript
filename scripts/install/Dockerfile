FROM ubuntu
RUN apt-get update && apt-get install -y --no-install-recommends apt-utils && \
        apt-get install -y -q wget \
        build-essential \
        python \
        unzip \
        libbsd-dev \
        git \
        sudo \
        vim \
        curl \
        libssl-dev \
        cmake \
        iproute2 \
        net-tools \
        iputils-ping \
        inotify-tools

RUN useradd -m admin && echo "admin:admin" | chpasswd && adduser admin sudo
RUN echo "admin ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers
USER admin
WORKDIR /home/admin
RUN wget https://deb.nodesource.com/setup_11.x && chmod +x ./setup_11.x && echo admin | sudo -S ./setup_11.x && \
        sudo apt-get install -y -q nodejs

RUN git clone --recursive https://github.com/citelab/JAMScript && \
        cd JAMScript/tools && git checkout master && git pull && \
        cd ../samples && git checkout master && git pull

RUN mkdir ~/.npm-global && npm config set prefix '~/.npm-global'

WORKDIR /home/admin/JAMScript
RUN npm -g install jamscript
ENV PATH="/home/admin/.npm-global/bin:$PATH"
RUN mkdir /home/admin/temp
WORKDIR /home/admin/temp

CMD sudo chmod -R a+Xr /etc/avahi && sudo sed -i "s|rlimit-nproc=3|#rlimit-nproc=3 |g" /etc/avahi/avahi-daemon.conf && sudo chmod -R a+Xr /var/run && cd /var/run/ && sudo rm -rf dbus && sudo mkdir dbus && sudo dbus-daemon --system &&  sudo avahi-daemon
