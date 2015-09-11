package vietnamworks.com.pal.components;

import android.content.Context;
import android.support.v7.widget.RecyclerView;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import vietnamworks.com.pal.R;
import vietnamworks.com.pal.models.AppModel;
import vietnamworks.com.pal.models.RecentThread;
import vietnamworks.com.pal.utils.Common;

/**
 * Created by duynk on 9/11/15.
 */
public class RecentThreadListAdapter extends RecyclerView.Adapter<RecentThreadListAdapter.ViewHolder> {
    Context context;
    public  RecentThreadListAdapter(Context context) {
        this.context = context;
    }

    @Override
    public ViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.recent_thread_card, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public int getItemCount() {
        int totalItem = AppModel.recentThreadData.getData().size();
        return totalItem;
    }

    @Override
    public void onBindViewHolder(final ViewHolder holder, final int position) {
        RecentThread item = (RecentThread) AppModel.recentThreadData.getData().get(position);

        holder.uiTitle.setText(item.title);
        holder.uiCreatedDate.setText(Common.getDateString(item.createdDate));
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        protected TextView uiTitle;
        protected TextView uiCreatedDate;
        public ViewHolder(View view) {
            super(view);
            this.uiTitle = (TextView) view.findViewById(R.id.title);
            this.uiCreatedDate = (TextView) view.findViewById(R.id.createdDate);
        }
    }
}
