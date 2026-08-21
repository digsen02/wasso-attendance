import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { attendanceService, authService, notificationService, reportService, submissionPeriodService, userService } from '../services';
import { ReportStatus } from '../data/seed';

const AppContext=createContext(null);
const initial={ready:false,loading:false,error:null,currentUser:null,users:[],logs:[],reports:[],periods:[],notifications:[],toast:null};
function reducer(state,action){
  switch(action.type){
    case 'LOADING':return {...state,loading:true,error:null}; case 'READY':return {...state,...action.payload,ready:true,loading:false,error:null};
    case 'ERROR':return {...state,loading:false,error:action.payload}; case 'USER':return {...state,currentUser:action.payload,loading:false,error:null};
    case 'DATA':return {...state,...action.payload,loading:false,error:null}; case 'TOAST':return {...state,toast:action.payload}; case 'CLEAR_TOAST':return state.toast?.id===action.payload?{...state,toast:null}:state; default:return state;
  }
}
export function AppProvider({children}){
  const [state,dispatch]=useReducer(reducer,initial);
  const refresh=useCallback(async()=>{ const [users,logs,reports,periods,notifications]=await Promise.all([userService.list(),attendanceService.list(),reportService.list(),submissionPeriodService.list(),notificationService.list()]); dispatch({type:'DATA',payload:{users,logs,reports,periods,notifications}}); },[]);
  useEffect(()=>{(async()=>{try{const currentUser=await authService.restore(); let data={users:[],logs:[],reports:[],periods:[],notifications:[]}; if(currentUser){const [users,logs,reports,periods,notifications]=await Promise.all([userService.list(),attendanceService.list(),reportService.list(),submissionPeriodService.list(),notificationService.list()]);data={users,logs,reports,periods,notifications};}dispatch({type:'READY',payload:{currentUser,...data}});}catch(e){dispatch({type:'READY',payload:{currentUser:null}});}})();},[]);
  const run=async(task,success)=>{dispatch({type:'LOADING'});try{const result=await task();if(success){const toast={id:crypto.randomUUID(),kind:'success',message:success};dispatch({type:'TOAST',payload:toast});setTimeout(()=>dispatch({type:'CLEAR_TOAST',payload:toast.id}),2600);}return result;}catch(e){dispatch({type:'ERROR',payload:e.message});const toast={id:crypto.randomUUID(),kind:'error',message:e.message};dispatch({type:'TOAST',payload:toast});setTimeout(()=>dispatch({type:'CLEAR_TOAST',payload:toast.id}),3200);throw e;}finally{dispatch({type:'DATA',payload:{}});}};
  const actions=useMemo(()=>({
    login:async(username,password)=>{const user=await run(()=>authService.login(username,password));dispatch({type:'USER',payload:user});await refresh();return user;},
    signup:input=>run(()=>authService.signup(input),'가입이 완료되었습니다.'),
    logout:async()=>{await authService.logout();dispatch({type:'READY',payload:{...initial,ready:true}});},
    saveDraft:async(report,logs)=>{await run(()=>reportService.saveDraft(report,logs),'임시 저장되었습니다.');await refresh();},
    uploadPdf:async(report,file)=>{await run(()=>reportService.upload(report,file,state.currentUser),'PDF 업로드 및 파일명 변경이 완료되었습니다.');await refresh();},
    submitReport:async(report,logs)=>{await run(()=>reportService.submit(report,logs,state.currentUser,state.users),'출근부가 최종 제출되었습니다.');await refresh();},
    reviewReport:async(report,student,status)=>{await run(()=>reportService.review(report,student,status),status===ReportStatus.APPROVED?'승인 처리되었습니다.':'반려 처리되었습니다.');await refresh();},
    getReportUrl:report=>run(()=>reportService.downloadUrl(report)),
    sendReminder:async(user)=>{await run(()=>notificationService.reminder(user),`${user.name} 학생에게 Reminder를 재발송했습니다.`);await refresh();},
    markRead:async(id)=>{await notificationService.markRead(id);await refresh();}, clearError:()=>dispatch({type:'ERROR',payload:null}),
  }),[refresh,state.currentUser,state.users]);
  return <AppContext.Provider value={{state,actions}}>{children}</AppContext.Provider>;
}
export const useApp=()=>{const value=useContext(AppContext);if(!value)throw new Error('useApp은 AppProvider 내부에서 사용해야 합니다.');return value;};
