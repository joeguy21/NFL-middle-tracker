"use strict";
self.addEventListener("push",event=>{
 let data={title:"NFL Middle Tracker",body:"You have a tracker update.",url:"/"};
 try{const parsed=event.data?.json();if(parsed&&typeof parsed==="object")data={...data,...parsed}}catch{}
 const title=String(data.title||"NFL Middle Tracker").slice(0,120);
 const body=String(data.body||"You have a tracker update.").slice(0,500);
 const url=typeof data.url==="string"&&data.url.startsWith("/")?data.url:"/";
 event.waitUntil(self.registration.showNotification(title,{body,icon:"/apple-touch-icon.png",badge:"/apple-touch-icon.png",data:{url},tag:typeof data.tag==="string"?data.tag:undefined}));
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const url=event.notification.data?.url||"/";
 event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(clients=>{
  const match=clients.find(c=>new URL(c.url).origin===self.location.origin);
  if(match){match.focus();return match.navigate(url)}
  return self.clients.openWindow(url);
 }));
});
