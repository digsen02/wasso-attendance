export const statusMeta={
  PRESENT:{label:'출근',tone:'success'},LATE:{label:'지각',tone:'warn'},ABSENT:{label:'결근',tone:'danger'},VACATION:{label:'휴가',tone:'info'},
  NOT_STARTED:{label:'미작성',tone:'neutral'},WRITING:{label:'작성 중',tone:'warn'},SUBMITTED:{label:'제출 완료',tone:'info'},APPROVED:{label:'승인',tone:'success'},REJECTED:{label:'반려',tone:'danger'},
};
export const formatDateTime=value=>value?new Intl.DateTimeFormat('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'—';
export const getDday=(period,now=new Date())=>{
  if(!period)return null;
  const end=new Date(period.endDate); end.setHours(0,0,0,0);
  const today=new Date(now); today.setHours(0,0,0,0);
  return Math.max(0,Math.round((end-today)/86400000));
};
