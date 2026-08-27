import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { attendanceService, authService, notificationService, reportService, submissionPeriodService, userService } from '../services';
import { ReportStatus } from '../domain/enums';

const AppContext=createContext(null);
const now=new Date();
const defaultMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
const initial={ready:false,loading:false,error:null,currentUser:null,selectedMonth:defaultMonth,users:[],logs:[],reports:[],periods:[],notifications:[],reportHistory:[],toast:null};

function reducer(state,action){
  switch(action.type){
    case 'LOADING':return {...state,loading:true,error:null};
    case 'READY':return {...state,...action.payload,ready:true,loading:false,error:null};
    case 'ERROR':return {...state,loading:false,error:action.payload};
    case 'USER':return {...state,currentUser:action.payload,loading:false,error:null};
    case 'DATA':return {...state,...action.payload,loading:false,error:null};
    case 'TOAST':return {...state,toast:action.payload};
    case 'CLEAR_TOAST':return state.toast?.id===action.payload?{...state,toast:null}:state;
    default:return state;
  }
}

export function AppProvider({children}){
  const [state,dispatch]=useReducer(reducer,initial);
  const refresh=useCallback(async()=>{
    const [users,logs,reports,periods,notifications,reportHistory]=await Promise.all([
      userService.list(),attendanceService.list(),reportService.list(),
      submissionPeriodService.list(),notificationService.list(),reportService.history(),
    ]);
    dispatch({type:'DATA',payload:{users,logs,reports,periods,notifications,reportHistory}});
  },[]);

  useEffect(()=>{(async()=>{
    try{
      const currentUser=await authService.restore();
      let data={users:[],logs:[],reports:[],periods:[],notifications:[],reportHistory:[]};
      if(currentUser){
        const [users,logs,reports,periods,notifications,reportHistory]=await Promise.all([
          userService.list(),attendanceService.list(),reportService.list(),
          submissionPeriodService.list(),notificationService.list(),reportService.history(),
        ]);
        data={users,logs,reports,periods,notifications,reportHistory};
      }
      dispatch({type:'READY',payload:{currentUser,...data}});
    }catch{
      dispatch({type:'READY',payload:{currentUser:null}});
    }
  })();},[]);

  const run=async(task,success)=>{
    dispatch({type:'LOADING'});
    try{
      const result=await task();
      if(success){
        const toast={id:crypto.randomUUID(),kind:'success',message:success};
        dispatch({type:'TOAST',payload:toast});
        setTimeout(()=>dispatch({type:'CLEAR_TOAST',payload:toast.id}),2600);
      }
      return result;
    }catch(e){
      const message=e.message||'요청 처리에 실패했습니다.';
      dispatch({type:'ERROR',payload:message});
      const toast={id:crypto.randomUUID(),kind:'error',message};
      dispatch({type:'TOAST',payload:toast});
      setTimeout(()=>dispatch({type:'CLEAR_TOAST',payload:toast.id}),3200);
      throw e;
    }finally{
      dispatch({type:'DATA',payload:{}});
    }
  };

  const actions=useMemo(()=>(
    {
      login:async(username,password,role)=>{const user=await run(()=>authService.login(username,password,role));dispatch({type:'USER',payload:user});await refresh();return user;},
      signup:input=>run(()=>authService.signup(input),'가입이 완료되었습니다.'),
      createStudent:async(input)=>{await run(()=>userService.create(input),'학생 계정을 생성했습니다.');await refresh();},
      updateProfile:async(input)=>{const user=await run(()=>userService.updateMine(input),'프로필을 저장했습니다.');dispatch({type:'USER',payload:user});await refresh();},
      updateStudent:async(input)=>{await run(()=>userService.updateStudent(input),'학생 정보를 저장했습니다.');await refresh();},
      changePassword:password=>run(()=>authService.changePassword(password),'비밀번호를 변경했습니다.'),
      logout:async()=>{await authService.logout();dispatch({type:'READY',payload:{...initial,ready:true}});},
      saveDraft:async(report,logs)=>{await run(()=>reportService.saveDraft(report,logs),'임시 저장했습니다.');await refresh();},
      uploadPdf:async(report,file)=>{await run(()=>reportService.upload(report,file,state.currentUser),'PDF 업로드를 완료했습니다.');await refresh();},
      submitReport:async(report,logs)=>{await run(()=>reportService.submit(report,logs),'출근부를 최종 제출했습니다.');await refresh();},
      reviewReport:async(report,student,status,reason)=>{await run(()=>reportService.review(report,student,status,reason),status===ReportStatus.APPROVED?'승인 처리했습니다.':'반려 처리했습니다.');await refresh();},
      getReportUrl:report=>run(()=>reportService.downloadUrl(report)),
      sendReminder:async(user)=>{await run(()=>notificationService.reminder(user,state.selectedMonth),`${user.name} 학생에게 리마인더를 보냈습니다.`);await refresh();},
      sendBulkReminders:async()=>{const count=await run(()=>notificationService.bulkReminder(state.selectedMonth));const toast={id:crypto.randomUUID(),kind:'success',message:`미제출자 ${count}명에게 리마인더를 보냈습니다.`};dispatch({type:'TOAST',payload:toast});setTimeout(()=>dispatch({type:'CLEAR_TOAST',payload:toast.id}),2600);await refresh();return count;},
      getDashboard:()=>run(()=>reportService.dashboard(state.selectedMonth)),
      savePeriod:async(startDate,endDate)=>{await run(()=>submissionPeriodService.save(state.selectedMonth,startDate,endDate),'제출 기간을 저장했습니다.');await refresh();},
      selectMonth:yearMonth=>dispatch({type:'DATA',payload:{selectedMonth:yearMonth}}),
      markRead:async(id)=>{await notificationService.markRead(id);await refresh();},
      clearError:()=>dispatch({type:'ERROR',payload:null}),
    }
  ),[refresh,state.currentUser,state.selectedMonth]);

  return <AppContext.Provider value={{state,actions}}>{children}</AppContext.Provider>;
}

export const useApp=()=>{
  const value=useContext(AppContext);
  if(!value)throw new Error('useApp은 AppProvider 내부에서 사용해야 합니다.');
  return value;
};
